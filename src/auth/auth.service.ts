import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const BCRYPT_SALT_ROUNDS = 10;

export type SignupInput = { email: string; password: string };

export function isSignupInput(value: unknown): value is SignupInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.email === 'string' &&
    typeof input.password === 'string' &&
    input.password.length >= 8
  );
}

export type LoginInput = { email: string; password: string };

export function isLoginInput(value: unknown): value is LoginInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return typeof input.email === 'string' && typeof input.password === 'string';
}

export type OAuthCodeInput = { code: string; redirectUri: string };

export function isOAuthCodeInput(value: unknown): value is OAuthCodeInput {
  if (typeof value !== 'object' || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.code === 'string' && typeof input.redirectUri === 'string'
  );
}

type AuthUser = { id: string; email: string };
type AuthResult = { token: string; user: AuthUser };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private async issueToken(user: AuthUser): Promise<AuthResult> {
    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { token, user };
  }

  async signup(input: SignupInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictException('이미 가입된 이메일입니다.');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: { email: input.email, passwordHash, provider: 'local' },
    });

    return this.issueToken({ id: user.id, email: user.email });
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);

    if (!isMatch) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      );
    }

    return this.issueToken({ id: user.id, email: user.email });
  }

  async loginWithKakao(input: OAuthCodeInput): Promise<AuthResult> {
    const clientId = process.env.KAKAO_CLIENT_ID;

    if (!clientId) {
      throw new BadRequestException('카카오 로그인이 설정되지 않았습니다.');
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: input.redirectUri,
      code: input.code,
      ...(process.env.KAKAO_CLIENT_SECRET
        ? { client_secret: process.env.KAKAO_CLIENT_SECRET }
        : {}),
    });

    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      throw new BadRequestException('카카오 인증에 실패했습니다.');
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenData.access_token) {
      throw new BadRequestException('카카오 인증에 실패했습니다.');
    }

    const profileResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      throw new BadRequestException('카카오 프로필 조회에 실패했습니다.');
    }

    const profile = (await profileResponse.json()) as {
      id: number;
      kakao_account?: { email?: string };
    };

    const email = profile.kakao_account?.email;

    if (!email) {
      throw new BadRequestException(
        '카카오 계정에 이메일 제공 동의가 필요합니다.',
      );
    }

    const user = await this.upsertSocialUser({
      provider: 'kakao',
      providerId: String(profile.id),
      email,
    });

    return this.issueToken(user);
  }

  async loginWithGoogle(input: OAuthCodeInput): Promise<AuthResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new BadRequestException('Google 로그인이 설정되지 않았습니다.');
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    });

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      throw new BadRequestException('Google 인증에 실패했습니다.');
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
    };

    if (!tokenData.access_token) {
      throw new BadRequestException('Google 인증에 실패했습니다.');
    }

    const profileResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );

    if (!profileResponse.ok) {
      throw new BadRequestException('Google 프로필 조회에 실패했습니다.');
    }

    const profile = (await profileResponse.json()) as {
      sub: string;
      email?: string;
    };

    if (!profile.email) {
      throw new BadRequestException(
        'Google 계정에서 이메일을 가져오지 못했습니다.',
      );
    }

    const user = await this.upsertSocialUser({
      provider: 'google',
      providerId: profile.sub,
      email: profile.email,
    });

    return this.issueToken(user);
  }

  // 같은 이메일로 가입된 계정(로컬 또는 다른 소셜)이 이미 있으면 새로 만들지
  // 않고 그대로 합류시킨다 — 한 사람이 이메일/카카오/구글을 섞어 써도 진단
  // 이력이 한 계정에 모이도록.
  private async upsertSocialUser(input: {
    provider: string;
    providerId: string;
    email: string;
  }): Promise<AuthUser> {
    const existingByProvider = await this.prisma.user.findUnique({
      where: {
        provider_providerId: {
          provider: input.provider,
          providerId: input.providerId,
        },
      },
    });

    if (existingByProvider) {
      return { id: existingByProvider.id, email: existingByProvider.email };
    }

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingByEmail) {
      return { id: existingByEmail.id, email: existingByEmail.email };
    }

    const created = await this.prisma.user.create({
      data: {
        email: input.email,
        provider: input.provider,
        providerId: input.providerId,
      },
    });

    return { id: created.id, email: created.email };
  }

  async getUserIdFromAuthHeader(
    authHeader: string | undefined,
  ): Promise<string | null> {
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      const payload = await this.jwtService.verifyAsync<{ sub: string }>(token);
      return payload.sub;
    } catch {
      return null;
    }
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('로그인이 필요합니다.');
    }

    return { id: user.id, email: user.email };
  }
}
