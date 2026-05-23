import { SaasPlansService } from './saas-plans.service';

describe('SaasPlansService', () => {
  function createService() {
    const prisma = {
      saasPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: 1,
          ...data,
          storageLimitBytes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      },
    };
    const service = new SaasPlansService(prisma as any);

    return { service, prisma };
  }

  it('generates a plan code when create payload omits code', async () => {
    const { service, prisma } = createService();

    await service.create({
      name: '专业版',
      priceCents: 9900,
      durationDays: 365,
    } as any);

    expect(prisma.saasPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: expect.stringMatching(/^plan_[a-z0-9]{8}$/),
      }),
    });
  });

  it('does not persist removed billing cycle or feature flag fields', async () => {
    const { service, prisma } = createService();

    await service.create({
      name: '试用套餐',
      priceCents: 0,
      durationDays: 14,
      billingCycle: 'monthly',
      featureFlags: { beta: true },
    } as any);

    expect(prisma.saasPlan.create).toHaveBeenCalledWith({
      data: expect.not.objectContaining({
        billingCycle: expect.anything(),
        featureFlags: expect.anything(),
      }),
    });
  });
});
