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

export type AiActionScenario = {
  beforeText: string;
  afterText: string;
  reductionGoalText: string;
  costSavingText: string;
  evidenceText: string;
  projectedTons: number | null;
  percentReduction: number | null;
  estimatedMonthlySavingsWon: number | null;
  currentAnnualCostWon: number | null;
  projectedAnnualCostWon: number | null;
  annualSavingsWon: number | null;
  costEvidenceText: string;
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
  scenario: AiActionScenario | null;
};

type SelectedActionRaw = {
  code: string;
  reason: string;
  carbonSavingExplanation: string;
  costSavingExplanation: string;
  scenario: AiActionScenario | null;
};

export type AiInsightOutput = {
  aiSummary: string;
  aiEvidenceBullets: { text: string; isPositive: boolean }[];
  actionReasons: Record<string, string>;
  selectedActions: SelectedActionRaw[];
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

function buildPrompt(
  input: AiInsightInput,
  availableActions: Array<{
    code: string;
    title: string;
    description: string;
    difficulty: string;
    costLabel: string;
    reductionRateMin: number;
    reductionRateMax: number;
  }>,
): string {
  const annualKg = input.annualEmissionTons * 1000;

  const factorsText = input.rankedFactors
    .map(
      (f) =>
        `${f.rank}위: ${f.factor} (동종업 평균 대비 ${f.valuePercent > 0 ? '+' : ''}${f.valuePercent.toFixed(1)}%)`,
    )
    .join('\n');

  const actionsText = availableActions
    .map(
      (a) =>
        `- ${a.code}: ${a.title} | 난이도: ${a.difficulty} | 비용: ${a.costLabel} | 절감범위: ${Math.round(a.reductionRateMin * annualKg)}~${Math.round(a.reductionRateMax * annualKg)}kg/년`,
    )
    .join('\n');

  return `당신은 소상공인 탄소 배출 전문 상담사입니다.

【언어 규칙 - 절대 위반 금지】
- 모든 답변을 순수한 한국어로만 작성하세요.
- 영어 단어, 한자, 일본어, 특수기호(CO₂·tCO₂e 등 단위 제외)를 절대 사용하지 마세요.
- "LED", "kWh", "CO₂" 같은 기술 용어는 그대로 사용해도 됩니다.
- 그 외 모든 단어는 반드시 한국어로 번역해 사용하세요.

아래 데이터를 분석해 결과를 작성하세요.

[진단 데이터]
- 연간 탄소 배출량: ${input.annualEmissionTons.toFixed(3)}t CO₂e (등급: ${input.grade})
- 전기 기여 비율: ${input.elecRatioPercent.toFixed(1)}%
- 가스 기여 비율: ${input.gasRatioPercent.toFixed(1)}%
- 전국 평균 대비: ${input.diffVsNationalPercent > 0 ? '+' : ''}${input.diffVsNationalPercent.toFixed(1)}%
- 동종업 평균 대비: ${input.diffVsIndustryPercent > 0 ? '+' : ''}${input.diffVsIndustryPercent.toFixed(1)}%

[주요 원인 요인 (XGBoost 분석 결과)]
${factorsText}

[선택 가능한 감축 액션 목록]
${actionsText}

위 XGBoost 분석 수치를 직접 인용해 이 업체에 가장 효과적인 액션을 반드시 3개 이상 선택하고 설명하세요.
각 설명에는 반드시 위 수치(비율, kg, %)를 구체적으로 인용해야 합니다.
scenario.projectedTons: 이 액션 실행 후 예상 연간 탄소 배출량 (tCO2e, 소수점 둘째 자리)
scenario.percentReduction: 현재 대비 절감 비율 (%, 소수점 첫째 자리)
scenario.estimatedMonthlySavingsWon: 예상 월간 전기요금 절감액 (원 단위 정수)
scenario.currentAnnualCostWon: 현재 연간 전기요금 추정액 (원 단위 정수, 사용량 기준 추산)
scenario.projectedAnnualCostWon: 이 액션 실행 후 예상 연간 전기요금 (원 단위 정수)
scenario.annualSavingsWon: 연간 절감 예상액 = currentAnnualCostWon - projectedAnnualCostWon (원 단위 정수)
scenario.costEvidenceText: 위 비용 추산 근거 한 문장 (어떤 수치를 어떻게 계산했는지, 순수 한국어)

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "aiSummary": "핵심 인사이트 2문장 이내 (위 수치 직접 인용, 순수 한국어)",
  "aiEvidenceBullets": [
    {"text": "XGBoost 수치를 인용한 근거 문장 (순수 한국어)", "isPositive": true},
    {"text": "개선 필요 항목 근거 문장 (순수 한국어)", "isPositive": false},
    {"text": "추가 근거 문장 (순수 한국어)", "isPositive": true}
  ],
  "selectedActions": [
    {
      "code": "액션코드",
      "reason": "이 업체 XGBoost 분석 수치를 직접 인용한 추천 이유 (예: 전기 기여 비율이 XX%로 동종업 대비 XX% 높기 때문에...) 순수 한국어 1-2문장",
      "carbonSavingExplanation": "탄소 절감량 근거 (위 절감범위 수치 인용, 순수 한국어)",
      "costSavingExplanation": "비용 절감 근거 (순수 한국어)",
      "scenario": {
        "beforeText": "현재 상황 한 문장 (위 수치 인용, 순수 한국어)",
        "afterText": "이 액션 실행 후 개선 모습 한 문장 (절감 kg 수치 포함, 순수 한국어)",
        "reductionGoalText": "절감 목표 요약 (예: 연간 XXkg 탄소 절감, 순수 한국어)",
        "costSavingText": "비용 절감 요약 (예: 월 전기요금 약 X만원 절약, 순수 한국어)",
        "evidenceText": "XGBoost 원인 분석 수치(주요 요인 비율·동종업 비교 등)를 직접 인용해 이 액션이 왜 효과적인지 2-3문장 (순수 한국어)",
        "projectedTons": 1.23,
        "percentReduction": 21.7,
        "estimatedMonthlySavingsWon": 15000,
        "currentAnnualCostWon": 624000,
        "projectedAnnualCostWon": 520000,
        "annualSavingsWon": 104000,
        "costEvidenceText": "현재 전기 사용량과 요금 단가를 기준으로 추정한 연간 전기요금이며, 이 액션 실행 시 절감 비율을 적용해 예상 절감액을 산출했습니다."
      }
    }
  ]
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

  // 구버전 actionReasons 파싱 (하위 호환)
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

  // 신버전 selectedActions 파싱
  const selectedActions: SelectedActionRaw[] = Array.isArray(
    parsed.selectedActions,
  )
    ? (parsed.selectedActions as unknown[])
        .filter(
          (a): a is Record<string, unknown> =>
            typeof a === 'object' && a !== null,
        )
        .map((a) => {
          const rawScenario =
            typeof a.scenario === 'object' && a.scenario !== null
              ? (a.scenario as Record<string, unknown>)
              : null;
          const scenario: AiActionScenario | null = rawScenario
            ? {
                beforeText:
                  typeof rawScenario.beforeText === 'string'
                    ? rawScenario.beforeText
                    : '',
                afterText:
                  typeof rawScenario.afterText === 'string'
                    ? rawScenario.afterText
                    : '',
                reductionGoalText:
                  typeof rawScenario.reductionGoalText === 'string'
                    ? rawScenario.reductionGoalText
                    : '',
                costSavingText:
                  typeof rawScenario.costSavingText === 'string'
                    ? rawScenario.costSavingText
                    : '',
                evidenceText:
                  typeof rawScenario.evidenceText === 'string'
                    ? rawScenario.evidenceText
                    : '',
                projectedTons:
                  typeof rawScenario.projectedTons === 'number'
                    ? rawScenario.projectedTons
                    : null,
                percentReduction:
                  typeof rawScenario.percentReduction === 'number'
                    ? rawScenario.percentReduction
                    : null,
                estimatedMonthlySavingsWon:
                  typeof rawScenario.estimatedMonthlySavingsWon === 'number'
                    ? rawScenario.estimatedMonthlySavingsWon
                    : null,
                currentAnnualCostWon:
                  typeof rawScenario.currentAnnualCostWon === 'number'
                    ? rawScenario.currentAnnualCostWon
                    : null,
                projectedAnnualCostWon:
                  typeof rawScenario.projectedAnnualCostWon === 'number'
                    ? rawScenario.projectedAnnualCostWon
                    : null,
                annualSavingsWon:
                  typeof rawScenario.annualSavingsWon === 'number'
                    ? rawScenario.annualSavingsWon
                    : null,
                costEvidenceText:
                  typeof rawScenario.costEvidenceText === 'string'
                    ? rawScenario.costEvidenceText
                    : '',
              }
            : null;
          return {
            code: typeof a.code === 'string' ? a.code : '',
            reason: typeof a.reason === 'string' ? a.reason : '',
            carbonSavingExplanation:
              typeof a.carbonSavingExplanation === 'string'
                ? a.carbonSavingExplanation
                : '',
            costSavingExplanation:
              typeof a.costSavingExplanation === 'string'
                ? a.costSavingExplanation
                : '',
            scenario,
          };
        })
        .filter((a) => a.code !== '')
    : [];

  return { aiSummary, aiEvidenceBullets, actionReasons, selectedActions, actions: [] };
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
    const annualKg = input.annualEmissionTons * 1000;

    // DB에서 전체 액션 목록을 가져와 Gemini에 선택지로 제공한다.
    const allDbActions = (await this.actionsService.findAll()) as Array<{
      code: string;
      icon: string | null;
      title: string;
      description: string;
      difficulty: string;
      costLabel: string;
      reductionRateMin: number;
      reductionRateMax: number;
    }>;

    const prompt = buildPrompt(input, allDbActions);
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

    // Gemini가 선택한 액션 코드로 DB 상세 정보를 조회해 합친다.
    const selectedCodes = parsed.selectedActions.map((a) => a.code);
    const dbActionMap = new Map(allDbActions.map((a) => [a.code, a]));

    const actions: AiActionOutput[] = parsed.selectedActions
      .map((sel) => {
        const db = dbActionMap.get(sel.code);
        if (!db) return null;
        return {
          code: db.code,
          icon: db.icon ?? null,
          title: db.title,
          description: db.description,
          difficulty: db.difficulty,
          costLabel: db.costLabel,
          expectedMinKg: Math.round(db.reductionRateMin * annualKg),
          expectedMaxKg: Math.round(db.reductionRateMax * annualKg),
          reason: [
            sel.reason,
            sel.carbonSavingExplanation,
            sel.costSavingExplanation,
          ]
            .filter(Boolean)
            .join('\n\n'),
          scenario: sel.scenario,
        };
      })
      .filter((a): a is AiActionOutput => a !== null);

    // selectedCodes에 없는 코드는 actionReasons 폴백으로 채운다.
    if (actions.length === 0 && Object.keys(parsed.actionReasons).length > 0) {
      const fallbackCodes = Object.keys(parsed.actionReasons);
      fallbackCodes.forEach((code) => {
        const db = dbActionMap.get(code);
        if (!db) return;
        actions.push({
          code: db.code,
          icon: db.icon ?? null,
          title: db.title,
          description: db.description,
          difficulty: db.difficulty,
          costLabel: db.costLabel,
          expectedMinKg: Math.round(db.reductionRateMin * annualKg),
          expectedMaxKg: Math.round(db.reductionRateMax * annualKg),
          reason: parsed.actionReasons[code] ?? '',
          scenario: null,
        });
      });
    }

    void selectedCodes; // 사용됨을 명시 (lint)
    return { ...parsed, actions };
  }
}
