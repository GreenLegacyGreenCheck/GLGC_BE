import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type FieldType = 'text' | 'phone' | 'email' | 'date' | 'address' | 'bank';

export type FormField = {
  key: string;      // 영문 식별자 (name, address, ...)
  label: string;    // 한국어 레이블
  type: FieldType;
  // pdf-lib 좌표 (pt, y=0 at BOTTOM)
  x: number;
  y: number;
  size: number;
  // 기존 샘플 데이터를 지울 흰 사각형
  clearX: number;
  clearY: number;
  clearW: number;
  clearH: number;
};

export type SignaturePosition = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FormAnalysis = {
  fields: FormField[];
  signatures: SignaturePosition[];
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;

// y좌표 변환: Gemini는 위→아래 기준 %, pdf-lib는 아래→위 pt
function toPdfY(yTopPct: number, heightPct = 0): number {
  return (1 - yTopPct - heightPct) * PAGE_H;
}

const FIELD_TYPE_HINTS: Record<string, FieldType> = {
  name: 'text', birthDate: 'date', address: 'address',
  landlinePhone: 'phone', mobilePhone: 'phone', email: 'email',
  installLocation: 'text', installPeriod: 'text',
  bankName: 'bank', accountHolder: 'text', accountNumber: 'text',
};

@Injectable()
export class FormsService {
  // 분석 결과를 URL 기준으로 캐시 (프로세스 재시작 전까지 유지)
  private readonly cache = new Map<string, FormAnalysis>();

  constructor(private readonly configService: ConfigService) {}

  // ─── Gemini 멀티모달 호출 (PDF 인라인 데이터 + 텍스트 프롬프트) ────────────
  private async callGeminiWithPdf(
    pdfBase64: string,
    prompt: string,
  ): Promise<string> {
    const keys = [
      this.configService.get<string>('GEMINI_API_KEY'),
      this.configService.get<string>('GEMINI_API_KEY2'),
      this.configService.get<string>('GEMINI_API_KEY3'),
    ].filter((k): k is string => Boolean(k));

    if (keys.length === 0) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');

    for (const apiKey of keys) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  // PDF 첨부
                  { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
                  // 텍스트 프롬프트
                  { text: prompt },
                ],
              }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          },
        );

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Gemini ${res.status}: ${err}`);
        }

        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
        return text;
      } catch (err) {
        if (apiKey === keys[keys.length - 1]) throw err;
      }
    }
    throw new Error('모든 Gemini 키 소진');
  }

  // ─── 분석 프롬프트 ─────────────────────────────────────────────────────────
  private buildPrompt(): string {
    return `이 문서는 한국 정부 지원사업 신청서 PDF입니다. 첫 번째 페이지(페이지 0)를 분석해주세요.

신청인이 직접 입력해야 하는 모든 개인정보 필드를 찾아주세요.
각 필드에 대해 다음 정보를 제공하세요:
- key: 영어 식별자 (name, birthDate, address, landlinePhone, mobilePhone, email, installLocation, installPeriod, bankName, accountHolder, accountNumber 중 해당하는 것)
- label: 양식에 표시된 한국어 레이블
- type: "text" | "phone" | "email" | "date" | "address" | "bank"
- textXPct: 텍스트를 쓸 x 위치 (페이지 너비 대비 0~1, 왼쪽=0)
- textYPct: 텍스트를 쓸 y 위치 (페이지 높이 대비 0~1, 위=0 아래=1)
- clearXPct, clearYPct: 기존 예시 텍스트를 지울 영역 좌상단 (0~1)
- clearWPct, clearHPct: 지울 영역 너비/높이 (0~1)

또한 "(인)" 또는 "(서명 또는 인)" 텍스트가 있는 위치를 sigXPct, sigYPct로 알려주세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "fields": [
    {
      "key": "name",
      "label": "성명",
      "type": "text",
      "textXPct": 0.30,
      "textYPct": 0.185,
      "clearXPct": 0.25,
      "clearYPct": 0.175,
      "clearWPct": 0.245,
      "clearHPct": 0.026
    }
  ],
  "signatures": [
    { "sigXPct": 0.76, "sigYPct": 0.724 }
  ]
}`;
  }

  // ─── 공개 API ──────────────────────────────────────────────────────────────
  async analyzeFormFields(pdfUrl: string): Promise<FormAnalysis> {
    if (this.cache.has(pdfUrl)) return this.cache.get(pdfUrl)!;

    // 1. PDF 가져오기
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) throw new Error(`PDF 불러오기 실패: ${pdfUrl}`);
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
    const pdfBase64 = pdfBuffer.toString('base64');

    // 2. Gemini 분석
    const raw = await this.callGeminiWithPdf(pdfBase64, this.buildPrompt());

    // 3. JSON 파싱
    const parsed = JSON.parse(raw) as {
      fields: {
        key: string; label: string; type: string;
        textXPct: number; textYPct: number;
        clearXPct: number; clearYPct: number;
        clearWPct: number; clearHPct: number;
      }[];
      signatures: { sigXPct: number; sigYPct: number }[];
    };

    // 4. % → pdf-lib 좌표 변환
    const fields: FormField[] = parsed.fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: (FIELD_TYPE_HINTS[f.key] ?? f.type) as FieldType,
      x: f.textXPct * PAGE_W,
      y: toPdfY(f.textYPct),
      size: 10,
      clearX: f.clearXPct * PAGE_W,
      clearY: toPdfY(f.clearYPct, f.clearHPct),
      clearW: f.clearWPct * PAGE_W,
      clearH: f.clearHPct * PAGE_H,
    }));

    // 5. 서명 위치 변환 (페이지 0만, 크기는 고정)
    const signatures: SignaturePosition[] = parsed.signatures.map((s) => ({
      page: 0,
      x: s.sigXPct * PAGE_W,
      y: toPdfY(s.sigYPct, 0.033),
      w: 55,
      h: 30,
    }));

    const result: FormAnalysis = { fields, signatures };
    this.cache.set(pdfUrl, result);
    return result;
  }
}
