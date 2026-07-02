import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActionsService } from '../actions/actions.service';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { RagService } from '../rag/rag.service';

export type CreateDiagnosisInput = {
  target: string;
  electricityRatio: number;
  gasRatio: number;
  targetEmissionKg: number;
  address?: string;
  usageKwh?: number;
  gasUsageMj?: number;
  billingMonth?: string;
};

export function isCreateDiagnosisInput(
  value: unknown,
): value is CreateDiagnosisInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.target === 'string' &&
    typeof input.electricityRatio === 'number' &&
    typeof input.gasRatio === 'number' &&
    typeof input.targetEmissionKg === 'number' &&
    (input.address === undefined || typeof input.address === 'string') &&
    (input.usageKwh === undefined || typeof input.usageKwh === 'number') &&
    (input.gasUsageMj === undefined || typeof input.gasUsageMj === 'number') &&
    (input.billingMonth === undefined || typeof input.billingMonth === 'string')
  );
}

const RECOMMENDED_ACTION_INCLUDE = {
  recommendedActions: { include: { action: true } },
} as const;

@Injectable()
export class DiagnosisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actionsService: ActionsService,
    private readonly ragService: RagService,
    private readonly pushService: PushService,
  ) {}

  // XGBoost가 아직 없어서 고정값을 반환한다. 실제 모델이 붙으면 이 메서드만
  // 교체하면 되도록 호출부(create)는 입력값과 무관하게 이 메서드만 거친다.
  private getTopFactors() {
    return [
      { factor: 'electricityUsage', label: '전기 사용량', importance: 0.42 },
      { factor: 'coolingUsage', label: '냉방설비 사용', importance: 0.18 },
      { factor: 'gasUsage', label: '가스 사용량', importance: 0.11 },
    ];
  }

  private pickActionCodes({
    electricityRatio,
    gasRatio,
  }: Pick<CreateDiagnosisInput, 'electricityRatio' | 'gasRatio'>): string[] {
    const codes = new Set<string>();

    if (electricityRatio >= 0.6) {
      ['LED_LIGHTING', 'STANDBY_POWER', 'HVAC_EFFICIENCY'].forEach((code) =>
        codes.add(code),
      );
    }

    if (gasRatio >= 0.4) {
      ['INSULATION', 'HEATING_EFFICIENCY'].forEach((code) => codes.add(code));
    }

    return Array.from(codes);
  }

  async create(input: CreateDiagnosisInput, userId: string | null) {
    const topFactors = this.getTopFactors();
    const actionCodes = this.pickActionCodes(input);
    const actions = await this.actionsService.findByCodes(actionCodes);

    const diagnosis = await this.prisma.diagnosis.create({
      data: {
        userId: userId ?? undefined,
        target: input.target,
        electricityRatio: input.electricityRatio,
        gasRatio: input.gasRatio,
        targetEmissionKg: input.targetEmissionKg,
        address: input.address,
        usageKwh: input.usageKwh,
        gasUsageMj: input.gasUsageMj,
        billingMonth: input.billingMonth,
        topFactors,
        recommendedActions: {
          create: actions.map((action) => ({
            actionId: action.id,
            expectedMinKg: input.targetEmissionKg * action.reductionRateMin,
            expectedMaxKg: input.targetEmissionKg * action.reductionRateMax,
          })),
        },
      },
      include: RECOMMENDED_ACTION_INCLUDE,
    });

    // 진단 완료 푸시 알림 — diagnosisAlert가 ON인 로그인 유저에게만 발송
    if (userId) {
      const setting = await this.prisma.notificationSetting.findUnique({
        where: { userId },
      });
      if (setting?.diagnosisAlert) {
        this.pushService
          .sendToUser(
            userId,
            '탄소 진단 완료! 🌿',
            '진단 리포트가 준비됐어요.',
            '/report',
          )
          .catch(() => {});
      }
    }

    return diagnosis;
  }

  async findById(id: string) {
    const diagnosis = await this.prisma.diagnosis.findUnique({
      where: { id },
      include: RECOMMENDED_ACTION_INCLUDE,
    });

    if (!diagnosis) {
      throw new NotFoundException('진단 결과를 찾을 수 없습니다.');
    }

    return diagnosis;
  }

  async delete(id: string, userId: string) {
    const diagnosis = await this.prisma.diagnosis.findUnique({ where: { id } });
    if (!diagnosis) throw new NotFoundException('진단을 찾을 수 없습니다.');
    if (diagnosis.userId !== userId)
      throw new ForbiddenException('본인의 진단만 삭제할 수 있습니다.');
    await this.prisma.diagnosis.delete({ where: { id } });
  }

  async getPolicyForAction(diagnosisId: string, actionCode: string) {
    const diagnosis = await this.findById(diagnosisId);

    // 진단의 recommendedActions에서 먼저 찾고, 없으면 DB에서 직접 조회한다.
    // Gemini가 전체 액션 풀에서 자율 추천하므로 diagnosis에 없는 액션도 허용한다.
    const fromRecommended = diagnosis.recommendedActions.find(
      (r) => r.action.code === actionCode,
    );

    const action = fromRecommended?.action
      ?? await this.actionsService.findByCodes([actionCode]).then((list) => list[0] ?? null);

    if (!action) {
      throw new NotFoundException('존재하지 않는 액션 코드입니다.');
    }

    return this.ragService.recommend({
      cause: action.cause,
      target: diagnosis.target,
    });
  }
}
