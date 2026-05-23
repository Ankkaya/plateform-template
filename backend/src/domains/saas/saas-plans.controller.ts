import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformJwtAuthGuard } from '@/domains/platform-auth/guards/platform-jwt-auth.guard';
import { PlatformPermissionsGuard } from '@/domains/platform-auth/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '@/domains/platform-auth/decorators/platform-permissions.decorator';
import { CreateSaasPlanDto } from './dto/create-saas-plan.dto';
import { UpdateSaasPlanDto } from './dto/update-saas-plan.dto';
import { SaasPlansService } from './saas-plans.service';

@ApiTags('平台接口/套餐管理')
@Controller('platform/plans')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@ApiBearerAuth()
export class SaasPlansController {
  constructor(private readonly plansService: SaasPlansService) {}

  @Post()
  @RequirePlatformPermissions('platform:plan:create')
  @ApiOperation({ summary: '创建套餐' })
  create(@Body() dto: CreateSaasPlanDto) {
    return this.plansService.create(dto);
  }

  @Get()
  @RequirePlatformPermissions('platform:plan:view')
  @ApiOperation({ summary: '套餐列表' })
  findAll() {
    return this.plansService.findAll();
  }

  @Get(':id')
  @RequirePlatformPermissions('platform:plan:view')
  @ApiOperation({ summary: '套餐详情' })
  findOne(@Param('id') id: string) {
    return this.plansService.findOne(+id);
  }

  @Patch(':id')
  @RequirePlatformPermissions('platform:plan:update')
  @ApiOperation({ summary: '更新套餐' })
  update(@Param('id') id: string, @Body() dto: UpdateSaasPlanDto) {
    return this.plansService.update(+id, dto);
  }

  @Delete(':id')
  @RequirePlatformPermissions('platform:plan:delete')
  @ApiOperation({ summary: '删除套餐' })
  remove(@Param('id') id: string) {
    return this.plansService.remove(+id);
  }
}
