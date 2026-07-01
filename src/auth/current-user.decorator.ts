import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from './jwt-auth.guard';

// JwtAuthGuard가 먼저 request.user를 채워둔 라우트에서만 사용한다.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { id: string } => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
