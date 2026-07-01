import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt'),
      verifyAsync: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('signup', () => {
    it('hashes the password and issues a token for a new email', async () => {
      type CreateArgs = { data: { email: string; passwordHash: string } };

      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockImplementation(({ data }: CreateArgs) =>
        Promise.resolve({ id: 'user-1', ...data }),
      );

      const result = await service.signup({
        email: 'new@example.com',
        password: 'password1234',
      });

      expect(result).toEqual({
        token: 'signed-jwt',
        user: { id: 'user-1', email: 'new@example.com' },
      });

      const [createCall] = prisma.user.create.mock.calls[0] as [CreateArgs];
      expect(createCall.data.passwordHash).not.toBe('password1234');
      expect(
        await bcrypt.compare('password1234', createCall.data.passwordHash),
      ).toBe(true);
    });

    it('rejects when the email is already taken', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.signup({
          email: 'taken@example.com',
          password: 'password1234',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('issues a token when the password matches', async () => {
      const passwordHash = await bcrypt.hash('password1234', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
      });

      const result = await service.login({
        email: 'user@example.com',
        password: 'password1234',
      });

      expect(result.token).toBe('signed-jwt');
      expect(result.user).toEqual({ id: 'user-1', email: 'user@example.com' });
    });

    it('rejects an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'nobody@example.com',
          password: 'password1234',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const passwordHash = await bcrypt.hash('password1234', 10);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        passwordHash,
      });

      await expect(
        service.login({
          email: 'user@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('getUserIdFromAuthHeader', () => {
    it('returns null when the header is missing', async () => {
      await expect(
        service.getUserIdFromAuthHeader(undefined),
      ).resolves.toBeNull();
    });

    it('returns null when the token is invalid', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(
        service.getUserIdFromAuthHeader('Bearer bad-token'),
      ).resolves.toBeNull();
    });

    it('returns the user id from a valid token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1' });

      await expect(
        service.getUserIdFromAuthHeader('Bearer good-token'),
      ).resolves.toBe('user-1');
    });
  });
});
