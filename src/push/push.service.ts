import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export type PushSubscriptionInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export function isPushSubscriptionInput(
  value: unknown,
): value is PushSubscriptionInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.endpoint === 'string' &&
    typeof input.p256dh === 'string' &&
    typeof input.auth === 'string'
  );
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly isConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT');

    if (publicKey && privateKey && subject) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.isConfigured = true;
    } else {
      this.isConfigured = false;
      this.logger.warn(
        'VAPID 키가 설정되지 않았습니다. 푸시 알림이 비활성화됩니다.',
      );
    }
  }

  async subscribe(userId: string, input: PushSubscriptionInput) {
    // 같은 endpoint가 이미 있으면 갱신, 없으면 생성
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { userId, ...input },
      update: { userId, p256dh: input.p256dh, auth: input.auth },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async sendToUser(userId: string, title: string, body: string, url = '/') {
    if (!this.isConfigured) return;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    const payload = JSON.stringify({ title, body, url });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          // 410 Gone = 구독 만료 → DB에서 삭제
          if (
            typeof err === 'object' &&
            err !== null &&
            'statusCode' in err &&
            (err as { statusCode: number }).statusCode === 410
          ) {
            await this.prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
          }
        }
      }),
    );
  }

  // appUpdate 브로드캐스트 — appUpdate=true인 모든 유저에게 발송
  async broadcastAppUpdate(title: string, body: string) {
    if (!this.isConfigured) return;

    const settings = await this.prisma.notificationSetting.findMany({
      where: { appUpdate: true },
      include: { user: { include: { pushSubscriptions: true } } },
    });

    const payload = JSON.stringify({ title, body, url: '/' });

    const allSubs = settings.flatMap((s) => s.user.pushSubscriptions);

    await Promise.allSettled(
      allSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
          );
        } catch (err: unknown) {
          if (
            typeof err === 'object' &&
            err !== null &&
            'statusCode' in err &&
            (err as { statusCode: number }).statusCode === 410
          ) {
            await this.prisma.pushSubscription.delete({
              where: { id: sub.id },
            });
          }
        }
      }),
    );
  }

  getVapidPublicKey(): string {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') ?? '';
  }
}
