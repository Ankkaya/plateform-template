import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateSaasPlanDto } from './dto/create-saas-plan.dto';
import { UpdateSaasPlanDto } from './dto/update-saas-plan.dto';
import { mbToBytes, toPlanVo } from './saas-presenter';

@Injectable()
export class SaasPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSaasPlanDto) {
    const code = dto.code?.trim() || await this.generatePlanCode();
    await this.ensureCodeAvailable(code);
    const plan = await this.prisma.saasPlan.create({
      data: {
        name: dto.name.trim(),
        code,
        description: dto.description?.trim() || null,
        priceCents: dto.priceCents ?? 0,
        userLimit: dto.userLimit ?? null,
        storageLimitBytes: mbToBytes(dto.storageLimitMb) ?? null,
        durationDays: dto.durationDays,
        isEnabled: dto.isEnabled ?? true,
        sort: dto.sort ?? 0,
      },
    });
    return toPlanVo(plan);
  }

  async findAll() {
    const plans = await this.prisma.saasPlan.findMany({
      where: { deletedAt: null },
      orderBy: [{ sort: 'asc' }, { id: 'asc' }],
    });
    return plans.map(toPlanVo);
  }

  async findOne(id: number) {
    const plan = await this.prisma.saasPlan.findFirst({
      where: { id, deletedAt: null },
    });
    if (!plan) {
      throw new NotFoundException('套餐不存在');
    }
    return toPlanVo(plan);
  }

  async update(id: number, dto: UpdateSaasPlanDto) {
    const existing = await this.prisma.saasPlan.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('套餐不存在');
    }

    if (dto.code && dto.code.trim() !== existing.code) {
      await this.ensureCodeAvailable(dto.code, id);
    }

    const plan = await this.prisma.saasPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.code !== undefined ? { code: dto.code.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.userLimit !== undefined ? { userLimit: dto.userLimit } : {}),
        ...(dto.storageLimitMb !== undefined ? { storageLimitBytes: mbToBytes(dto.storageLimitMb) } : {}),
        ...(dto.durationDays !== undefined ? { durationDays: dto.durationDays } : {}),
        ...(dto.isEnabled !== undefined ? { isEnabled: dto.isEnabled } : {}),
        ...(dto.sort !== undefined ? { sort: dto.sort } : {}),
      },
    });
    return toPlanVo(plan);
  }

  async remove(id: number) {
    await this.findOne(id);
    const activeSubscriptions = await this.prisma.tenantSubscription.count({
      where: { planId: id, deletedAt: null },
    });
    if (activeSubscriptions > 0) {
      throw new ConflictException('套餐已被租户订阅使用，不能删除');
    }

    await this.prisma.saasPlan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { id };
  }

  private async generatePlanCode() {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `plan_${randomBytes(4).toString('hex')}`;
      const existing = await this.prisma.saasPlan.findFirst({
        where: { code, deletedAt: null },
        select: { id: true },
      });
      if (!existing) {
        return code;
      }
    }

    throw new ConflictException('套餐编码生成冲突，请重试');
  }

  private async ensureCodeAvailable(code: string, excludeId?: number) {
    const existing = await this.prisma.saasPlan.findFirst({
      where: {
        code: code.trim(),
        deletedAt: null,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException('套餐编码已存在');
    }
  }
}
