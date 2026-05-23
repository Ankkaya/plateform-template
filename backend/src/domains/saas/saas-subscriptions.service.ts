import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { toSubscriptionVo } from './saas-presenter';

@Injectable()
export class SaasSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const subscriptions = await this.prisma.tenantSubscription.findMany({
      where: { deletedAt: null },
      include: {
        tenant: true,
        plan: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    return subscriptions.map(toSubscriptionVo);
  }

  async cancel(id: number) {
    const existing = await this.prisma.tenantSubscription.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('订阅不存在');
    }
    if (existing.status !== 'ACTIVE' || (existing.expiresAt && existing.expiresAt.getTime() <= Date.now())) {
      throw new BadRequestException('只有有效订阅可以取消');
    }

    const subscription = await this.prisma.tenantSubscription.update({
      where: { id },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
      include: {
        tenant: true,
        plan: true,
      },
    });
    return toSubscriptionVo(subscription);
  }
}
