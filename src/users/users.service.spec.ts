import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    diagnosis: { findMany: jest.Mock };
    notificationSetting: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      diagnosis: { findMany: jest.fn() },
      notificationSetting: { findUnique: jest.fn(), upsert: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
  });

  describe('getMyDiagnoses', () => {
    it('returns an empty summary when the user has no diagnoses', async () => {
      prisma.diagnosis.findMany.mockResolvedValue([]);

      const result = await service.getMyDiagnoses('user-1');

      expect(result.diagnoses).toEqual([]);
      expect(result.summary).toEqual({
        diagnosisCount: 0,
        lowestEmissionTons: 0,
        recentTrend: 'steady',
        trendChangePercent: 0,
        trendSparkline: [],
      });
    });

    it('computes grade, trend and sparkline from stored emissions', async () => {
      // findMany is mocked to already return createdAt-desc order, as Prisma would.
      prisma.diagnosis.findMany.mockResolvedValue([
        {
          id: 'd2',
          target: '소상공인',
          targetEmissionKg: 1000,
          usageKwh: 200,
          address: null,
          billingMonth: '2026-06',
          createdAt: new Date('2026-06-01'),
        },
        {
          id: 'd1',
          target: '소상공인',
          targetEmissionKg: 2000,
          usageKwh: 300,
          address: null,
          billingMonth: '2026-05',
          createdAt: new Date('2026-05-01'),
        },
      ]);

      const result = await service.getMyDiagnoses('user-1');

      expect(result.diagnoses[0]).toMatchObject({
        id: 'd2',
        grade: 'A',
        co2Tons: 1,
      });
      expect(result.diagnoses[1]).toMatchObject({
        id: 'd1',
        grade: 'B',
        co2Tons: 2,
      });
      expect(result.summary.diagnosisCount).toBe(2);
      expect(result.summary.lowestEmissionTons).toBe(1);
      expect(result.summary.recentTrend).toBe('improving');
      expect(result.summary.trendChangePercent).toBe(-50);
      expect(result.summary.trendSparkline).toEqual([2, 1]);
    });
  });

  describe('notification settings', () => {
    it('returns defaults when no row exists yet', async () => {
      prisma.notificationSetting.findUnique.mockResolvedValue(null);

      await expect(service.getNotificationSettings('user-1')).resolves.toEqual({
        diagnosisAlert: true,
        weeklyReport: true,
        goalAlert: false,
        appUpdate: false,
      });
    });

    it('upserts a partial update', async () => {
      prisma.notificationSetting.upsert.mockResolvedValue({
        diagnosisAlert: false,
        weeklyReport: true,
        goalAlert: false,
        appUpdate: false,
      });

      const result = await service.updateNotificationSettings('user-1', {
        diagnosisAlert: false,
      });

      expect(result.diagnosisAlert).toBe(false);
      expect(prisma.notificationSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });
});
