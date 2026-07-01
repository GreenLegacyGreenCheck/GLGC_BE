import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBody } from '@nestjs/swagger';
import {
  AuthService,
  isLoginInput,
  isOAuthCodeInput,
  isSignupInput,
} from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiBody({
    schema: {
      example: { email: 'user@example.com', password: 'password1234' },
    },
  })
  signup(@Body() body: unknown) {
    if (!isSignupInput(body)) {
      throw new BadRequestException(
        '이메일과 8자 이상의 비밀번호가 필요합니다.',
      );
    }

    return this.authService.signup(body);
  }

  @Post('login')
  @ApiBody({
    schema: {
      example: { email: 'user@example.com', password: 'password1234' },
    },
  })
  login(@Body() body: unknown) {
    if (!isLoginInput(body)) {
      throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    }

    return this.authService.login(body);
  }

  @Post('kakao')
  @ApiBody({
    schema: {
      example: {
        code: 'kakao-authorization-code',
        redirectUri: 'http://localhost:3000/login/kakao/callback',
      },
    },
  })
  loginWithKakao(@Body() body: unknown) {
    if (!isOAuthCodeInput(body)) {
      throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    }

    return this.authService.loginWithKakao(body);
  }

  @Post('google')
  @ApiBody({
    schema: {
      example: {
        code: 'google-authorization-code',
        redirectUri: 'http://localhost:3000/login/google/callback',
      },
    },
  })
  loginWithGoogle(@Body() body: unknown) {
    if (!isOAuthCodeInput(body)) {
      throw new BadRequestException('요청 형식이 올바르지 않습니다.');
    }

    return this.authService.loginWithGoogle(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }
}
