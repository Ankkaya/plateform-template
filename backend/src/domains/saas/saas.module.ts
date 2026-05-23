import { Module } from '@nestjs/common';
import { TenantAccessService } from './tenant-access.service';
import { PlatformAuthModule } from '@/domains/platform-auth/platform-auth.module';
import { IconAssetsModule } from '@/infrastructure/icon-assets/icon-assets.module';
import { QuotaModule } from './quota.module';
import { SaasPlansController } from './saas-plans.controller';
import { SaasMenusController } from './saas-menus.controller';
import { SaasTenantsController } from './saas-tenants.controller';
import { SaasSubscriptionsController } from './saas-subscriptions.controller';
import { SaasPlansService } from './saas-plans.service';
import { SaasMenusService } from './saas-menus.service';
import { SaasTenantsService } from './saas-tenants.service';
import { SaasSubscriptionsService } from './saas-subscriptions.service';
import { TenantBootstrapService } from './tenant-bootstrap.service';

@Module({
  imports: [PlatformAuthModule, IconAssetsModule, QuotaModule],
  controllers: [SaasPlansController, SaasMenusController, SaasTenantsController, SaasSubscriptionsController],
  providers: [
    TenantAccessService,
    SaasPlansService,
    SaasMenusService,
    SaasTenantsService,
    SaasSubscriptionsService,
    TenantBootstrapService,
  ],
  exports: [QuotaModule, TenantAccessService],
})
export class SaasModule {}
