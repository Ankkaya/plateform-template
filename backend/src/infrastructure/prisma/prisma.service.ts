import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { TenantContextService } from '@/common/tenant/tenant-context.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor(private readonly tenantContext: TenantContextService) {
    const connectionString = process.env.DATABASE_URL;
    if (typeof connectionString !== 'string' || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL 未配置或不是有效字符串，请检查 backend/.env、.env.development 或系统环境变量');
    }

    const pool = new Pool({
      connectionString,
    });
    super({ adapter: new PrismaPg(pool) });
    this.pool = pool;
  }

  getTenantId(): number | undefined {
    return this.tenantContext.getTenantId();
  }

  requireTenantId(): number {
    return this.tenantContext.requireTenantId();
  }

  withTenantWhere<T extends Record<string, unknown> | undefined>(
    where?: T,
  ): (T extends undefined ? { tenantId: number } : T & { tenantId: number }) {
    return {
      ...(where ?? {}),
      tenantId: this.requireTenantId(),
    } as T extends undefined ? { tenantId: number } : T & { tenantId: number };
  }

  withTenantData<T extends object>(data: T): T & { tenantId: number } {
    const tenantId = this.requireTenantId();
    this.assertTenantData(data as Record<string, unknown>, tenantId);
    return { ...data, tenantId };
  }

  withTenantCreateManyData<T extends object>(data: T[]): Array<T & { tenantId: number }> {
    const tenantId = this.requireTenantId();
    return data.map((item) => {
      this.assertTenantData(item as Record<string, unknown>, tenantId);
      return { ...item, tenantId };
    });
  }

  private assertTenantData(data: Record<string, unknown>, tenantId: number): void {
    if (data.tenantId === undefined) {
      return;
    }

    if (data.tenantId !== tenantId) {
      throw new BadRequestException('请求租户与数据租户不一致');
    }
  }

  async onModuleInit() {
    this.logger.log('正在连接数据库...');
    try {
      await this.$connect();
      this.logger.log('✅ 数据库连接成功');
      
      // 测试连接：执行简单查询
      const result = await this.$queryRaw`SELECT version()`;
      this.logger.log(`📦 PostgreSQL 版本: ${(result as any)[0].version}`);
    } catch (error) {
      this.logger.error('❌ 数据库连接失败:', error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('正在断开数据库连接...');
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('✅ 数据库连接已断开');
  }
}
