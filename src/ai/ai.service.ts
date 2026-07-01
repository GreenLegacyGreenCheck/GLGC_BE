import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActionsService } from '../actions/actions.service';

export type RankedFactor = {
  factor: string;
  valuePercent: number;
  rank: number;
};

export type AiInsightInput = {
  annualEmissionTons: number;
  grade: string;
  elecRatioPercent: number;
  gasRatioPercent: number;
  diffVsNationalPercent: number;
  diffVsIndustryPercent: number;
  rankedFactors: RankedFactor[];
  actions: { code: string; title: string }[];
};

export type AiActionOutput = {
  code: string;
  icon: string | null;
  title: string;
  description: string;
  difficulty: string;
  costLabel: string;
  expectedMinKg: number;
  expectedMaxKg: number;
  reason: string;
};

export type AiInsightOutput = {
  aiSummary: string;
  aiEvidenceBullets: { text: string; isPositive: boolean }[];
  actionReasons: Record<string, string>;
  actions: AiActionOutput[];
};

export function isAiInsightInput(value: unknown): value is AiInsightInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.annualEmissionTons === 'number' &&
    typeof input.grade === 'string' &&
    typeof input.elecRatioPercent === 'number' &&
    typeof input.gasRatioPercent === 'number' &&
    typeof input.diffVsNationalPercent === 'number' &&
    typeof input.diffVsIndustryPercent === 'number' &&
    Array.isArray(input.rankedFactors) &&
    Array.isArray(input.actions)
  );
}

function buildPrompt(input: AiInsightInput): string {
  const factorsText = input.rankedFactors
    .map(
      (f) =>
        `${f.rank}위: ${f.factor} (동종업 평균 대비 ${f.valuePercent > 0 ? '+' : ''}${f.valuePercent.toFixed(1)}%)`,
    )
    .join('\n');

  const actionsText = input.actions
    .map((a) => `- ${a.code}: ${a.title}`)
    .join('\n');

  return `당신은 소상공인 탄소 배출 분석 전문가입니다.
반드시 한국어로만 답변하세요. 영어나 다른 언어를 절대 섞지 마세요.
아래 데이터를 바탕으로 분석 결과를 작성해주세요.

[진단 데이터]
- 연간 탄소 배출량: ${input.annualEmissionTons}t CO₂e (등급: ${input.grade})
- 전기 기여 비율: ${input.elecRatioPercent.toFixed(1)}%
- 가스 기여 비율: ${input.gasRatioPercent.toFixed(1)}%
- 전국 평균 대비: ${input.diffVsNationalPercent > 0 ? '+' : ''}${input.diffVsNationalPercent.toFixed(1)}%
- 동종업 평균 대비: ${input.diffVsIndustryPercent > 0 ? '+' : ''}${input.diffVsIndustryPercent.toFixed(1)}%

[주요 원인 요인]
${factorsText}

[추천 감축 액션]
${actionsText}

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "aiSummary": "이번 진단에서 가장 눈여겨봐야 할 한 줄 핵심 인사이트 (2문장 이내)",
  "aiEvidenceBullets": [
    {"text": "구체적인 수치 포함 근거 문장", "isPositive": true},
    {"text": "개선이 필요한 부분 근거 문장", "isPositive": false},
    {"text": "추가 근거 문장", "isPositive": true}
  ],
  "actionReasons": {
    "액션코드": "이 액션을 추천하는 이유 (위 SHAP 데이터 기반, 1-2문장)"
  }
}`;
}

function parseAiResponse(raw: string): AiInsightOutput {
  // 마크다운 코드블록이 섞여 오는 경우 제거
  const cleaned = raw
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const aiSummary =
    typeof parsed.aiSummary === 'string' ? parsed.aiSummary : '';

  const rawBullets = Array.isArray(parsed.aiEvidenceBullets)
    ? parsed.aiEvidenceBullets
    : [];
  const aiEvidenceBullets = rawBullets
    .filter(
      (b): b is Record<string, unknown> => typeof b === 'object' && b !== null,
    )
    .map((b) => ({
      text: typeof b.text === 'string' ? b.text : '',
      isPositive: b.isPositive === true,
    }));

  const rawReasons =
    typeof parsed.actionReasons === 'object' && parsed.actionReasons !== null
      ? (parsed.actionReasons as Record<string, unknown>)
      : {};
  const actionReasons: Record<string, string> = {};
  for (const [code, reason] of Object.entries(rawReasons)) {
    if (typeof reason === 'string') {
      actionReasons[code] = reason;
    }
  }

  return { aiSummary, aiEvidenceBullets, actionReasons, actions: [] };
}

@Injectable()
export class AiService {
  constructor(
    private readonly configService: ConfigService,
    private readonly actionsService: ActionsService,
  ) {}

  private async callGeminiWithKey(
    apiKey: string,
    prompt: string,
  ): Promise<string> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini 오류: ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
    return text;
  }

  // GEMINI_API_KEY → GEMINI_API_KEY2 → GEMINI_API_KEY3 순서로 시도한다.
  // 각 키가 할당량을 소진하면 다음 키로 자동 전환.
  private async callGemini(prompt: string): Promise<string> {
    const keys = [
      this.configService.get<string>('GEMINI_API_KEY'),
      this.configService.get<string>('GEMINI_API_KEY2'),
      this.configService.get<string>('GEMINI_API_KEY3'),
    ].filter((k): k is string => Boolean(k));

    if (keys.length === 0) {
      throw new Error('GEMINI_API_KEY(2, 3) 중 하나 이상을 설정해야 합니다.');
    }

    let lastError: Error = new Error('Gemini 키가 없습니다.');
    for (const key of keys) {
      try {
        return await this.callGeminiWithKey(key, prompt);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    throw lastError;
  }

  private async callGroq(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    if (!apiKey) throw new Error('GROQ_API_KEY가 설정되지 않았습니다.');

    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Groq 오류: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq 응답이 비어 있습니다.');
    return text;
  }

  async generateInsight(input: AiInsightInput): Promise<AiInsightOutput> {
    const prompt = buildPrompt(input);
    let raw: string;

    try {
      raw = await this.callGemini(prompt);
    } catch {
      try {
        raw = await this.callGroq(prompt);
      } catch {
        throw new HttpException(
          'AI 분석 서비스에 일시적으로 연결할 수 없습니다.',
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    let parsed: AiInsightOutput;
    try {
      parsed = parseAiResponse(raw);
    } catch {
      throw new HttpException(
        'AI 응답 형식을 처리할 수 없습니다.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    // DB에서 액션 상세 정보를 조회해 Gemini reason과 합친다.
    // reductionRateMin/Max는 0~1 비율이므로 연간 배출량 기준으로 kg 환산한다.
    const annualKg = input.annualEmissionTons * 1000;
    const codes = input.actions.map((a) => a.code);
    const dbActions = await this.actionsService.findByCodes(codes);

    const actions: AiActionOutput[] = (
      dbActions as Array<{
        code: string;
        icon: string | null;
        title: string;
        description: string;
        difficulty: string;
        costLabel: string;
        reductionRateMin: number;
        reductionRateMax: number;
      }>
    ).map((a) => ({
      code: a.code,
      icon: a.icon ?? null,
      title: a.title,
      description: a.description,
      difficulty: a.difficulty,
      costLabel: a.costLabel,
      expectedMinKg: Math.round(a.reductionRateMin * annualKg),
      expectedMaxKg: Math.round(a.reductionRateMax * annualKg),
      reason: parsed.actionReasons[a.code] ?? '',
    }));

    return { ...parsed, actions };
  }
}
