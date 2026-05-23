import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformJwtAuthGuard } from '@/domains/platform-auth/guards/platform-jwt-auth.guard';
import { PlatformPermissionsGuard } from '@/domains/platform-auth/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '@/domains/platform-auth/decorators/platform-permissions.decorator';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantMenuGrantsDto } from './dto/update-tenant-menu-grants.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SaasTenantsService } from './saas-tenants.service';

@ApiTags('平台接口/租户管理')
@Controller('platform/tenants')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@ApiBearerAuth()
export class SaasTenantsController {
  constructor(private readonly tenantsService: SaasTenantsService) {}

  @Post()
  @RequirePlatformPermissions('platform:tenant:create')
  @ApiOperation({ summary: '创建租户并初始化默认数据' })
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  @RequirePlatformPermissions('platform:tenant:view')
  @ApiOperation({ summary: '租户列表' })
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id/menus')
  @RequirePlatformPermissions('platform:tenant:permissions')
  @ApiOperation({ summary: '租户菜单权限同步列表' })
  findMenus(@Param('id') id: string) {
    return this.tenantsService.findMenus(+id);
  }

  @Patch(':id/menus')
  @RequirePlatformPermissions('platform:tenant:permissions')
  @ApiOperation({ summary: '同步租户菜单权限范围' })
  updateMenuGrants(@Param('id') id: string, @Body() dto: UpdateTenantMenuGrantsDto) {
    return this.tenantsService.updateMenuGrants(+id, dto.menuIds);
  }

  @Get(':id')
  @RequirePlatformPermissions('platform:tenant:view')
  @ApiOperation({ summary: '租户详情' })
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(+id);
  }

  @Patch(':id')
  @RequirePlatformPermissions('platform:tenant:update')
  @ApiOperation({ summary: '更新租户' })
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(+id, dto);
  }

  @Delete(':id')
  @RequirePlatformPermissions('platform:tenant:delete')
  @ApiOperation({ summary: '删除租户' })
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(+id);
  }
}
