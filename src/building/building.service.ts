import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type BuildingUserType = '소상공인' | '일반가구';

// 건축물대장 주용도 코드 → 사용자 유형
// 01xxx: 단독주택류, 02xxx: 공동주택류 → 일반가구
// 그 외 (근린생활시설/판매/업무/숙박 등) → 소상공인
function mapPurposeCode(code: string): BuildingUserType {
  if (code.startsWith('01') || code.startsWith('02')) return '일반가구';
  return '소상공인';
}

type KakaoAddressDoc = {
  address?: {
    b_code: string;          // 법정동코드 10자리 (앞 5 = 시군구, 뒤 5 = 법정동)
    main_address_no: string; // 번
    sub_address_no: string;  // 지
    mountain_yn: string;     // Y=산, N=대지
  };
};

type BldItem = {
  mainPurpsCd?: string;
  mainPurpsCdNm?: string;
};

@Injectable()
export class BuildingService {
  constructor(private readonly configService: ConfigService) {}

  // ── Step 1: 주소 → 지번 코드 (Kakao Geocoding REST API) ─────────────────
  private async getJibunCodes(address: string): Promise<{
    sigunguCd: string;
    bjdongCd: string;
    platGbCd: string;
    bun: string;
    ji: string;
  } | null> {
    const kakaoKey = this.configService.get<string>('KAKAO_CLIENT_ID');
    if (!kakaoKey) return null;

    let res: Response;
    try {
      res = await fetch(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}&analyze_type=similar`,
        { headers: { Authorization: `KakaoAK ${kakaoKey}` } },
      );
    } catch {
      return null;
    }

    if (!res.ok) return null;

    const data = (await res.json()) as { documents?: KakaoAddressDoc[] };
    const addr = data.documents?.[0]?.address;
    if (!addr?.b_code) return null;

    return {
      sigunguCd: addr.b_code.slice(0, 5),
      bjdongCd: addr.b_code.slice(5, 10),
      platGbCd: addr.mountain_yn === 'Y' ? '1' : '0',
      bun: addr.main_address_no.padStart(4, '0'),
      ji: (addr.sub_address_no || '0').padStart(4, '0'),
    };
  }

  // ── Step 2: 지번 코드 → 건축물 주용도 코드 (국토부 건축물대장 API) ─────────
  private async getMainPurposeCode(params: {
    sigunguCd: string;
    bjdongCd: string;
    platGbCd: string;
    bun: string;
    ji: string;
  }): Promise<string | null> {
    const apiKey = this.configService.get<string>('BUILDING_API_KEY');
    if (!apiKey) return null;

    const qs = new URLSearchParams({
      serviceKey: apiKey,
      sigunguCd: params.sigunguCd,
      bjdongCd: params.bjdongCd,
      platGbCd: params.platGbCd,
      bun: params.bun,
      ji: params.ji,
      numOfRows: '1',
      pageNo: '1',
      _type: 'json',
    });

    let res: Response;
    try {
      res = await fetch(
        `https://apis.data.go.kr/1613000/BldRgstHubService/getBrBasisOulnInfo?${qs.toString()}`,
      );
    } catch {
      return null;
    }

    if (!res.ok) return null;

    const data = (await res.json()) as {
      response?: { body?: { items?: { item?: BldItem | BldItem[] } } };
    };

    const items = data.response?.body?.items?.item;
    if (!items) return null;

    const item: BldItem = Array.isArray(items) ? items[0] : items;
    return item?.mainPurpsCd ?? null;
  }

  // ── 공개 API ───────────────────────────────────────────────────────────────
  // 주소로 사용자 유형 추론. 실패하면 null 반환 → 호출부가 Z-score fallback 처리.
  async inferUserType(address: string): Promise<BuildingUserType | null> {
    if (!address.trim()) return null;

    const codes = await this.getJibunCodes(address);
    if (!codes) return null;

    const purposeCd = await this.getMainPurposeCode(codes);
    if (!purposeCd) return null;

    return mapPurposeCode(purposeCd);
  }
}
