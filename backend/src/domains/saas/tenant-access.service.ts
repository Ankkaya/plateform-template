import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';

type TenantWithSubscription = {
  id: number;
  status?: string;
  isEnabled: boolean;
  deletedAt: Date | null;
  subscription?: {
    status: string;
    expiresAt: Date | null;
    deletedAt?: Date | null;
  } | null;
};

@Injectable()
export class TenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertTenantUsable(tenantId: number): Promise<void> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    }) as TenantWithSubscription | null;

    if (!tenant || tenant.deletedAt) {
      throw new NotFoundException('租户不存在或已删除');
    }

    if (!tenant.isEnabled || tenant.status === 'DISABLED') {
      throw new ForbiddenException('租户已停用');
    }

    if (!tenant.subscription || tenant.subscription.deletedAt) {
      throw new ForbiddenException('租户订阅不存在');
    }

    if (['EXPIRED', 'CANCELED'].includes(tenant.subscription.status)) {
      throw new ForbiddenException('租户订阅已不可用');
    }

    const now = Date.now();

    if (tenant.subscription.expiresAt && tenant.subscription.expiresAt.getTime() <= now) {
      throw new ForbiddenException('租户订阅已过期');
    }

  }
}
