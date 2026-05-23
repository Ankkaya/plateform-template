import { SaasSubscriptionsService } from './saas-subscriptions.service';
import { BadRequestException } from '@nestjs/common';

describe('SaasSubscriptionsService', () => {
  it('derives expired status from the subscription end date in lists', async () => {
    const prisma = {
      tenantSubscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            status: 'ACTIVE',
            startsAt: new Date('2026-01-01T00:00:00.000Z'),
            expiresAt: new Date('2020-01-01T00:00:00.000Z'),
            plan: null,
            tenant: null,
          },
        ]),
      },
    };
    const service = new SaasSubscriptionsService(prisma as any);

    await expect(service.findAll()).resolves.toEqual([
      expect.objectContaining({ status: 'EXPIRED' }),
    ]);
  });

  it('cancels an active subscription', async () => {
    const prisma = {
      tenantSubscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, status: 'ACTIVE' }),
        update: jest.fn().mockResolvedValue({
          id: 1,
          status: 'CANCELED',
          canceledAt: new Date('2026-01-01T00:00:00.000Z'),
          plan: null,
          tenant: null,
        }),
      },
    };
    const service = new SaasSubscriptionsService(prisma as any);

    await service.cancel(1);

    expect(prisma.tenantSubscription.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'CANCELED',
        canceledAt: expect.any(Date),
      }),
    }));
  });

  it('rejects canceling an expired subscription', async () => {
    const prisma = {
      tenantSubscription: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          status: 'ACTIVE',
          expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        }),
        update: jest.fn(),
      },
    };
    const service = new SaasSubscriptionsService(prisma as any);

    await expect(service.cancel(1)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenantSubscription.update).not.toHaveBeenCalled();
  });
});
