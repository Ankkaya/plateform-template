import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

type ActiveSubscription = {
  plan?: {
    userLimit?: number | null;
    storageLimitBytes?: bigint | number | null;
  } | null;
};

@Injectable()
export class QuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanCreateUser(): Promise<void> {
    const tenantId = this.prisma.requireTenantId();
    const subscription = await this.getTenantSubscription(tenantId);
    const userLimit = subscription?.plan?.userLimit ?? null;

    if (userLimit === null || userLimit === undefined) {
      return;
    }

    const activeUsers = await this.prisma.user.count({
      where: { tenantId, deletedAt: null },
    });

    if (activeUsers >= userLimit) {
      throw new ConflictException(`租户用户数已达到套餐上限（${userLimit}）`);
    }
  }

  async assertCanUploadBytes(newBytes: number): Promise<void> {
    const tenantId = this.prisma.requireTenantId();
    const subscription = await this.getTenantSubscription(tenantId);
    const rawLimit = subscription?.plan?.storageLimitBytes ?? null;

    if (rawLimit === null || rawLimit === undefined) {
      return;
    }

    const storageLimitBytes = Number(rawLimit);
    const result = await this.prisma.uploadRecord.aggregate({
      where: {
        tenantId,
        status: { not: 'deleted' },
      },
      _sum: { size: true },
    });
    const usedBytes = Number(result._sum.size ?? 0);

    if (usedBytes + newBytes > storageLimitBytes) {
      throw new ConflictException('租户存储空间不足');
    }
  }

  private async getTenantSubscription(tenantId: number): Promise<ActiveSubscription | null> {
    return this.prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        deletedAt: null,
      },
      include: {
        plan: true,
      },
    }) as Promise<ActiveSubscription | null>;
  }
}
