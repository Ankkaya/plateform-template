import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantAccessService } from './tenant-access.service';

describe('TenantAccessService', () => {
  function createService(tenant: Record<string, unknown> | null) {
    const prisma = {
      tenant: {
        findFirst: jest.fn().mockResolvedValue(tenant),
      },
    };

    return {
      service: new TenantAccessService(prisma as any),
      prisma,
    };
  }

  it('allows an active tenant with an active non-expired subscription', async () => {
    const { service } = createService({
      id: 1,
      isEnabled: true,
      deletedAt: null,
      subscription: {
        status: 'ACTIVE',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });

    await expect(service.assertTenantUsable(1)).resolves.toBeUndefined();
  });

  it('rejects missing tenants', async () => {
    const { service } = createService(null);

    await expect(service.assertTenantUsable(1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects disabled tenants', async () => {
    const { service } = createService({
      id: 1,
      isEnabled: false,
      status: 'DISABLED',
      deletedAt: null,
      subscription: { status: 'ACTIVE', expiresAt: null },
    });

    await expect(service.assertTenantUsable(1)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects tenants with disabled lifecycle status even when the legacy flag is enabled', async () => {
    const { service } = createService({
      id: 1,
      isEnabled: true,
      status: 'DISABLED',
      deletedAt: null,
      subscription: { status: 'ACTIVE', expiresAt: null },
    });

    await expect(service.assertTenantUsable(1)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects expired subscriptions', async () => {
    const { service } = createService({
      id: 1,
      isEnabled: true,
      deletedAt: null,
      subscription: {
        status: 'ACTIVE',
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      },
    });

    await expect(service.assertTenantUsable(1)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects canceled subscriptions', async () => {
    const { service } = createService({
      id: 1,
      isEnabled: true,
      deletedAt: null,
      subscription: {
        status: 'CANCELED',
        expiresAt: null,
      },
    });

    await expect(service.assertTenantUsable(1)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
