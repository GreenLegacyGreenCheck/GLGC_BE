import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { isPushSubscriptionInput, PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  // 프론트엔드가 VAPID 공개 키를 가져와 브라우저 구독을 생성할 때 필요
  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.pushService.getVapidPublicKey() };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    if (!isPushSubscriptionInput(body)) {
      throw new BadRequestException('구독 정보 형식이 올바르지 않습니다.');
    }
    await this.pushService.subscribe(user.id, body);
    return { ok: true };
  }

  @Delete('subscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(
    @CurrentUser() user: { id: string },
    @Body() body: unknown,
  ) {
    const input = body as Record<string, unknown>;
    if (typeof input?.endpoint !== 'string') {
      throw new BadRequestException('endpoint가 필요합니다.');
    }
    await this.pushService.unsubscribe(user.id, input.endpoint);
    return { ok: true };
  }

  // 앱 업데이트 브로드캐스트 — PUSH_BROADCAST_SECRET이 맞아야 한다
  @Post('broadcast')
  async broadcast(@Body() body: unknown) {
    const input = body as Record<string, unknown>;
    const secret = process.env.PUSH_BROADCAST_SECRET;
    if (!secret || input?.secret !== secret) {
      throw new UnauthorizedException('브로드캐스트 권한이 없습니다.');
    }
    const title =
      typeof input.title === 'string' ? input.title : '🌿 GreenCheck 업데이트';
    const bodyText =
      typeof input.body === 'string' ? input.body : '새 기능이 추가됐어요!';
    await this.pushService.broadcastAppUpdate(title, bodyText);
    return { ok: true };
  }
}
