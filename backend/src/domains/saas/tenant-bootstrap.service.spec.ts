import { TenantBootstrapService } from './tenant-bootstrap.service';

describe('TenantBootstrapService', () => {
  function createService() {
    const createdTenant = {
      id: 2,
      name: 'Demo Tenant',
      code: 'demo',
    };
    const tx = {
      tenant: {
        create: jest.fn().mockResolvedValue(createdTenant),
        findFirst: jest.fn().mockResolvedValue({
          ...createdTenant,
          subscription: null,
        }),
      },
      tenantSubscription: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      role: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 10, code: 'admin' })
          .mockResolvedValueOnce({ id: 11, code: 'user' }),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
      menu: {
        create: jest.fn(async () => ({ id: 20 + tx.menu.create.mock.calls.length })),
        findMany: jest.fn().mockResolvedValue([{ id: 20 }, { id: 21 }]),
      },
      user: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
      dictionaryType: {
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 30 })
          .mockResolvedValueOnce({ id: 31 }),
      },
      dictionaryItem: {
        createMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
      systemSetting: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const prisma = {
      tenant: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      saasPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 3, code: 'free', durationDays: 365 }),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };
    const service = new TenantBootstrapService(prisma as any);

    return { service, tx, prisma };
  }

  it('generates a tenant code when creating a tenant', async () => {
    const { service, tx } = createService();
    const hashSpy = jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('hashed-password');

    await service.createTenant({
      name: 'Demo Tenant',
      planId: 3,
      adminUsername: 'admin',
      adminPassword: 'secret123',
    } as any);

    expect(tx.tenant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: expect.stringMatching(/^tenant_[a-z0-9]{8}$/),
      }),
    });

    hashSpy.mockRestore();
  });

  it('creates baseline system settings during tenant bootstrap', async () => {
    const { service, tx } = createService();
    const hashSpy = jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('hashed-password');

    await service.createTenant({
      name: 'Demo Tenant',
      planId: 3,
      adminUsername: 'admin',
      adminPassword: 'secret123',
      adminName: 'Tenant Admin',
      adminEmail: 'admin@demo.local',
    });

    expect(tx.systemSetting.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          tenantId: 2,
          key: 'mini-program.auth',
          category: 'mini-program',
          value: { wechatAppId: '', wechatAppSecret: '' },
        }),
        expect.objectContaining({
          tenantId: 2,
          key: 'wechat.pay',
          category: 'wechat',
          value: expect.objectContaining({
            mchId: '',
            privateKey: '',
          }),
        }),
      ]),
    });

    hashSpy.mockRestore();
  });

  it('does not default the initial tenant admin name when omitted', async () => {
    const { service, tx } = createService();
    const hashSpy = jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('hashed-password');

    await service.createTenant({
      name: 'Demo Tenant',
      planId: 3,
      adminUsername: 'admin',
      adminPassword: 'secret123',
    } as any);

    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: null,
      }),
    });

    hashSpy.mockRestore();
  });

  it('computes subscription dates from plan durationDays', async () => {
    const { service, tx, prisma } = createService();
    const hashSpy = jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('hashed-password');

    jest.spyOn(prisma.saasPlan, 'findFirst').mockResolvedValue({
      id: 3,
      code: 'pro',
      durationDays: 180,
    } as any);

    await service.createTenant({
      name: 'Demo Tenant',
      planId: 3,
      adminUsername: 'admin',
      adminPassword: 'secret123',
    } as any);

    const call = tx.tenantSubscription.create.mock.calls[0][0];
    const startsAt = call.data.startsAt as Date;
    const expiresAt = call.data.expiresAt as Date;

    expect(startsAt).toBeInstanceOf(Date);
    expect(call.data.status).toBe('ACTIVE');
    expect(call.data).not.toHaveProperty('trialEndsAt');
    expect(expiresAt.getTime()).toBe(startsAt.getTime() + 180 * 24 * 60 * 60 * 1000);

    hashSpy.mockRestore();
  });

  it('always starts new tenant subscriptions as active', async () => {
    const { service, tx, prisma } = createService();
    const hashSpy = jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('hashed-password');

    jest.spyOn(prisma.saasPlan, 'findFirst').mockResolvedValue({
      id: 3,
      code: 'basic',
      durationDays: 30,
    } as any);

    await service.createTenant({
      name: 'Demo Tenant',
      planId: 3,
      adminUsername: 'admin',
      adminPassword: 'secret123',
    } as any);

    expect(tx.tenantSubscription.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'ACTIVE',
        expiresAt: expect.any(Date),
      }),
    });

    hashSpy.mockRestore();
  });
});
