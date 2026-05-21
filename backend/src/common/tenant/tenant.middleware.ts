import { Injectable, NestMiddleware } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: any, _res: any, next: () => void): void {
    const tenantId = this.tenantContext.parseHeader(req.headers);
    req.tenantId = tenantId;
    this.tenantContext.run({ tenantId }, next);
  }
}
