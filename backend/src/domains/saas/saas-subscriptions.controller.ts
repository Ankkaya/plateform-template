import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformJwtAuthGuard } from '@/domains/platform-auth/guards/platform-jwt-auth.guard';
import { PlatformPermissionsGuard } from '@/domains/platform-auth/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '@/domains/platform-auth/decorators/platform-permissions.decorator';
import { SaasSubscriptionsService } from './saas-subscriptions.service';

@ApiTags('平台接口/订阅管理')
@Controller('platform/subscriptions')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@ApiBearerAuth()
export class SaasSubscriptionsController {
  constructor(private readonly subscriptionsService: SaasSubscriptionsService) {}

  @Get()
  @RequirePlatformPermissions('platform:subscription:view')
  @ApiOperation({ summary: '订阅列表' })
  findAll() {
    return this.subscriptionsService.findAll();
  }

  @Patch(':id/cancel')
  @RequirePlatformPermissions('platform:subscription:update')
  @ApiOperation({ summary: '取消订阅' })
  cancel(@Param('id') id: string) {
    return this.subscriptionsService.cancel(+id);
  }
}
