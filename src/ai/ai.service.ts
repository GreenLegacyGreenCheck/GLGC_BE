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

type ActionScenario = {
  beforeText: string;
  afterText: string;
  reductionGoalText: string;
  costSavingText: string;
};

type SelectedActionRaw = {
  code: string;
  reason: string;
  carbonSavingExplanation: string;
  costSavingExplanation: string;
  scenario: ActionScenario | null;
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

  return `당신은 소상공인 탄소 배출 분석 전문가입니다.
반드시 한국어로만 답변하세요. 영어나 다른 언어를 절대 섞지 마세요.
아래 데이터를 바탕으로 분석 결과를 작성해주세요.

[진단 데이터]
- 연간 탄소 배출량: ${input.annualEmissionTons.toFixed(3)}t CO₂e (등급: ${input.grade})
- 전기 기여 비율: ${input.elecRatioPercent.toFixed(1)}%
- 가스 기여 비율: ${input.gasRatioPercent.toFixed(1)}%
- 전국 평균 대비: ${input.diffVsNationalPercent > 0 ? '+' : ''}${input.diffVsNationalPercent.toFixed(1)}%
- 동종업 평균 대비: ${input.diffVsIndustryPercent > 0 ? '+' : ''}${input.diffVsIndustryPercent.toFixed(1)}%

[주요 원인 요인 (XGBoost 분석)]
${factorsText}

[선택 가능한 감축 액션 목록]
${actionsText}

위 데이터를 근거로 이 업체에 가장 효과적인 액션을 반드시 3개 이상 선택하고, 각 액션을 추천하는 이유와 기대 효과를 설명하세요.

다음 JSON 형식으로만 응답하세요 (마크다운 코드블록 없이 순수 JSON):
{
  "aiSummary": "이번 진단에서 가장 눈여겨봐야 할 핵심 인사이트 (2문장 이내, 구체적 수치 포함)",
  "aiEvidenceBullets": [
    {"text": "구체적인 수치 포함 근거 문장", "isPositive": true},
    {"text": "개선이 필요한 부분 근거 문장", "isPositive": false},
    {"text": "추가 근거 문장", "isPositive": true}
  ],
  "selectedActions": [
    {
      "code": "액션코드",
      "reason": "이 업체의 XGBoost 분석 결과를 근거로 이 액션을 추천하는 이유 (1-2문장, 구체적 수치 포함)",
      "carbonSavingExplanation": "예상 탄소 절감량과 그 근거 (예: 전기 사용량의 X%를 차지하는 조명을 교체하면 연간 약 XXkg 절감)",
      "costSavingExplanation": "예상 비용 절감과 그 근거 (예: 월 전기요금 약 X만원 절약 예상)",
      "scenario": {
        "beforeText": "현재 상황을 한 문장으로 (예: 전기 조명이 전체 소비전력의 30%를 차지하며 비효율적으로 운영 중)",
        "afterText": "이 액션 실행 후 개선된 모습을 한 문장으로 (예: LED 교체 후 조명 전력 소비 80% 감소, 연간 XXkg CO₂ 절감)",
        "reductionGoalText": "절감 목표 한 줄 요약 (예: 연간 XXkg CO₂ 절감)",
        "costSavingText": "비용 절감 한 줄 요약 (예: 월 X만원 전기요금 절약)"
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
          const scenario: ActionScenario | null = rawScenario
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
