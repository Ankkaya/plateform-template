import { BadRequestException, Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { TENANT_ID_FALLBACK_HEADER, TENANT_ID_HEADER } from './tenant.constants';

export interface TenantContext {
  tenantId?: number;
}

type HeaderValue = string | string[] | undefined;

@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantContext>();

  run<T>(context: TenantContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  getTenantId(): number | undefined {
    return this.storage.getStore()?.tenantId;
  }

  requireTenantId(): number {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new BadRequestException(`缺少 ${TENANT_ID_HEADER} 请求头`);
    }
    return tenantId;
  }

  parseHeader(headers: Record<string, HeaderValue> | undefined): number | undefined {
    const rawValue = headers?.[TENANT_ID_HEADER] ?? headers?.[TENANT_ID_FALLBACK_HEADER];
    if (rawValue === undefined) {
      return undefined;
    }

    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    const tenantId = Number(value);
    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      throw new BadRequestException(`${TENANT_ID_HEADER} 请求头必须是正整数`);
    }

    return tenantId;
  }
}
