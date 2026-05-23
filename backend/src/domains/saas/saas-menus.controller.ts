import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PlatformJwtAuthGuard } from '@/domains/platform-auth/guards/platform-jwt-auth.guard';
import { PlatformPermissionsGuard } from '@/domains/platform-auth/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '@/domains/platform-auth/decorators/platform-permissions.decorator';
import { BatchIdsDto } from '@/common/dto/batch-ids.dto';
import { CreateMenuDto } from '@/domains/menus/dto/create-menu.dto';
import { UpdateMenuDto } from '@/domains/menus/dto/update-menu.dto';
import { SaasMenusService } from './saas-menus.service';

@ApiTags('平台接口/菜单管理')
@Controller('platform/menus')
@UseGuards(PlatformJwtAuthGuard, PlatformPermissionsGuard)
@ApiBearerAuth()
export class SaasMenusController {
  constructor(private readonly menusService: SaasMenusService) {}

  @Post()
  @RequirePlatformPermissions('platform:menu:create')
  @ApiOperation({ summary: '创建系统菜单' })
  create(@Body() dto: CreateMenuDto) {
    return this.menusService.create(dto);
  }

  @Get()
  @RequirePlatformPermissions('platform:menu:view')
  @ApiQuery({ name: 'format', required: false, enum: ['tree', 'flat'], description: '返回格式：tree-树形(默认), flat-扁平列表' })
  @ApiOperation({ summary: '系统菜单列表' })
  findAll(@Query('format') format?: string) {
    return this.menusService.findAll(format);
  }

  @Get(':id')
  @RequirePlatformPermissions('platform:menu:view')
  @ApiOperation({ summary: '系统菜单详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.menusService.findOne(id);
  }

  @Patch(':id')
  @RequirePlatformPermissions('platform:menu:update')
  @ApiOperation({ summary: '更新系统菜单' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto) {
    return this.menusService.update(id, dto);
  }

  @Delete('batch')
  @RequirePlatformPermissions('platform:menu:batch-delete')
  @ApiOperation({ summary: '批量删除系统菜单' })
  removeMany(@Body() dto: BatchIdsDto) {
    return this.menusService.removeMany(dto.ids);
  }

  @Delete(':id')
  @RequirePlatformPermissions('platform:menu:delete')
  @ApiOperation({ summary: '删除系统菜单' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menusService.remove(id);
  }
}
