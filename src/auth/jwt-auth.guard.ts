import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

export type AuthenticatedRequest = Request & { user: { id: string } };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = await this.authService.getUserIdFromAuthHeader(
      request.headers.authorization,
    );

    if (!userId) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    request.user = { id: userId };
    return true;
  }
}
