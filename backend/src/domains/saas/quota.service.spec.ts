import { ConflictException } from '@nestjs/common';
import { QuotaService } from './quota.service';

describe('QuotaService', () => {
  function createService(overrides?: {
    userLimit?: number | null;
    storageLimitBytes?: number | null;
    activeUsers?: number;
    usedBytes?: number;
  }) {
    const userLimit = overrides && 'userLimit' in overrides ? overrides.userLimit : 2;
    const storageLimitBytes = overrides && 'storageLimitBytes' in overrides ? overrides.storageLimitBytes : 100;
    const prisma = {
      requireTenantId: jest.fn().mockReturnValue(1),
      tenantSubscription: {
        findFirst: jest.fn().mockResolvedValue({
          plan: {
            userLimit,
            storageLimitBytes,
          },
        }),
      },
      user: {
        count: jest.fn().mockResolvedValue(overrides?.activeUsers ?? 2),
      },
      uploadRecord: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { size: overrides?.usedBytes ?? 90 },
        }),
      },
    };

    return {
      service: new QuotaService(prisma as any),
      prisma,
    };
  }

  it('rejects tenant user creation when the active user count has reached the limit', async () => {
    const { service, prisma } = createService({ userLimit: 2, activeUsers: 2 });

    await expect(service.assertCanCreateUser()).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { tenantId: 1, deletedAt: null },
    });
  });

  it('allows tenant user creation when the plan has unlimited users', async () => {
    const { service } = createService({ userLimit: null, activeUsers: 100 });

    await expect(service.assertCanCreateUser()).resolves.toBeUndefined();
  });

  it('rejects uploads when the new files would exceed the storage quota', async () => {
    const { service, prisma } = createService({ storageLimitBytes: 100, usedBytes: 90 });

    await expect(service.assertCanUploadBytes(20)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.uploadRecord.aggregate).toHaveBeenCalledWith({
      where: {
        tenantId: 1,
        status: { not: 'deleted' },
      },
      _sum: { size: true },
    });
  });

  it('allows uploads when the plan has unlimited storage', async () => {
    const { service } = createService({ storageLimitBytes: null, usedBytes: 1024 });

    await expect(service.assertCanUploadBytes(1024)).resolves.toBeUndefined();
  });
});
