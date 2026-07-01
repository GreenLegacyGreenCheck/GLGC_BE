import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 실제 서비스의 OpenAPI 스펙(https://glgc-xgboost.onrender.com/openapi.json) 기준 —
// elec_kwh만 필수이고 나머지는 전부 optional/nullable이다. 이 스펙은 자주
// 바뀌어서(이미 한 번 industry_avg가 national/industry/kwh 셋으로 쪼개졌다),
// 백엔드는 그대로 통과만 시키고 형식만 느슨하게 검증한다.
export type XgboostDiagnoseInput = {
  elec_kwh: number;
  gas_mj?: number | null;
  device_usage?: Record<string, number> | null;
  national_avg_tco2?: number | null;
  industry_avg_tco2?: number | null;
  industry_avg_kwh?: number | null;
  esg_answers?: Record<string, number> | null;
  prev_elec_kwh?: number | null;
  prev_gas_mj?: number | null;
};

function isRecordOfNumbers(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value as Record<string, unknown>).every(
    (item) => typeof item === 'number',
  );
}

function isOptionalNumber(value: unknown): value is number | null | undefined {
  return value === undefined || value === null || typeof value === 'number';
}

function isOptionalRecordOfNumbers(
  value: unknown,
): value is Record<string, number> | null | undefined {
  return value === undefined || value === null || isRecordOfNumbers(value);
}

export function isXgboostDiagnoseInput(
  value: unknown,
): value is XgboostDiagnoseInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.elec_kwh === 'number' &&
    isOptionalNumber(input.gas_mj) &&
    isOptionalRecordOfNumbers(input.device_usage) &&
    isOptionalNumber(input.national_avg_tco2) &&
    isOptionalNumber(input.industry_avg_tco2) &&
    isOptionalNumber(input.industry_avg_kwh) &&
    isOptionalRecordOfNumbers(input.esg_answers) &&
    isOptionalNumber(input.prev_elec_kwh) &&
    isOptionalNumber(input.prev_gas_mj)
  );
}

@Injectable()
export class XgboostService {
  constructor(private readonly configService: ConfigService) {}

  private getBaseUrl(): string {
    const baseUrl = this.configService.get<string>('XGBOOST_API_URL');

    if (!baseUrl) {
      throw new HttpException(
        'XGBOOST_API_URL이 설정되지 않았습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return baseUrl;
  }

  // XGBoost 응답 스키마는 cause_analysis/esg_score 두 객체로 문서화돼 있지만,
  // 백엔드에서 별도로 가공하지 않고 프론트에 그대로 전달하므로 RagService의
  // recommend()처럼 그대로 통과시킨다.
  async diagnose(input: XgboostDiagnoseInput): Promise<unknown> {
    const baseUrl = this.getBaseUrl();

    let response: Response;

    try {
      response = await fetch(`${baseUrl}/xgboost-diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      throw new HttpException(
        'XGBoost 서비스에 연결할 수 없습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      throw new HttpException(
        'XGBoost 진단 요청이 실패했습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return response.json();
  }

  async getEsgQuestions(): Promise<unknown> {
    const baseUrl = this.getBaseUrl();

    let response: Response;

    try {
      response = await fetch(`${baseUrl}/esg-questions`);
    } catch {
      throw new HttpException(
        'XGBoost 서비스에 연결할 수 없습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    if (!response.ok) {
      throw new HttpException(
        'ESG 설문 문항 조회가 실패했습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return response.json();
  }
}
