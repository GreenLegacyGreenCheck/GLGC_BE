import { Injectable } from '@nestjs/common';
import { getGradeForKg } from '../common/grade';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationSettingInput = Partial<{
  diagnosisAlert: boolean;
  weeklyReport: boolean;
  goalAlert: boolean;
  appUpdate: boolean;
}>;

const NOTIFICATION_SETTING_KEYS = [
  'diagnosisAlert',
  'weeklyReport',
  'goalAlert',
  'appUpdate',
] as const;

export function isNotificationSettingInput(
  value: unknown,
): value is NotificationSettingInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    NOTIFICATION_SETTING_KEYS.some((key) => key in input) &&
    NOTIFICATION_SETTING_KEYS.every(
      (key) => input[key] === undefined || typeof input[key] === 'boolean',
    )
  );
}

const DEFAULT_NOTIFICATION_SETTING = {
  diagnosisAlert: true,
  weeklyReport: true,
  goalAlert: false,
  appUpdate: false,
};

type TrendDirection = 'improving' | 'steady' | 'worsening';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyDiagnoses(userId: string) {
    const diagnoses = await this.prisma.diagnosis.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const diagnosisViews = diagnoses.map((diagnosis) => ({
      id: diagnosis.id,
      target: diagnosis.target,
      grade: getGradeForKg(diagnosis.targetEmissionKg),
      co2Tons: diagnosis.targetEmissionKg / 1000,
      usageKwh: diagnosis.usageKwh,
      address: diagnosis.address,
      billingMonth: diagnosis.billingMonth,
      createdAt: diagnosis.createdAt,
    }));

    const diagnosisCount = diagnoses.length;
    const lowestEmissionTons =
      diagnosisCount > 0
        ? Math.min(...diagnoses.map((d) => d.targetEmissionKg)) / 1000
        : 0;

    const [latest, previous] = diagnoses; // 이미 createdAt desc로 정렬됨
    let recentTrend: TrendDirection = 'steady';
    let trendChangePercent = 0;

    if (latest && previous && previous.targetEmissionKg > 0) {
      trendChangePercent =
        ((latest.targetEmissionKg - previous.targetEmissionKg) /
          previous.targetEmissionKg) *
        100;

      if (trendChangePercent < -1) recentTrend = 'improving';
      else if (trendChangePercent > 1) recentTrend = 'worsening';
    }

    const trendSparkline = diagnoses
      .slice(0, 5)
      .map((d) => d.targetEmissionKg / 1000)
      .reverse();

    return {
      diagnoses: diagnosisViews,
      summary: {
        diagnosisCount,
        lowestEmissionTons,
        recentTrend,
        trendChangePercent: Math.round(trendChangePercent * 10) / 10,
        trendSparkline,
      },
    };
  }

  async getNotificationSettings(userId: string) {
    const setting = await this.prisma.notificationSetting.findUnique({
      where: { userId },
    });

    return setting
      ? {
          diagnosisAlert: setting.diagnosisAlert,
          weeklyReport: setting.weeklyReport,
          goalAlert: setting.goalAlert,
          appUpdate: setting.appUpdate,
        }
      : DEFAULT_NOTIFICATION_SETTING;
  }

  async updateNotificationSettings(
    userId: string,
    input: NotificationSettingInput,
  ) {
    const setting = await this.prisma.notificationSetting.upsert({
      where: { userId },
      create: { userId, ...DEFAULT_NOTIFICATION_SETTING, ...input },
      update: input,
    });

    return {
      diagnosisAlert: setting.diagnosisAlert,
      weeklyReport: setting.weeklyReport,
      goalAlert: setting.goalAlert,
      appUpdate: setting.appUpdate,
    };
  }
}
