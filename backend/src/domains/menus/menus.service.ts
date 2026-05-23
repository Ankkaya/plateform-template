import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuVo } from '@/menus/vo';
import { IconAssetsService } from '@/infrastructure/icon-assets/icon-assets.service';

@Injectable()
export class MenusService {
  constructor(
    private prisma: PrismaService,
    private iconAssetsService: IconAssetsService,
  ) {}

  async create(createMenuDto: CreateMenuDto) {
    await this.ensureTenantParent(createMenuDto.parentId);
    const menu = await this.prisma.menu.create({
      data: this.prisma.withTenantData({
        ...createMenuDto,
        isTenantGranted: false,
      }),
    });
    return this.toMenuVo(menu);
  }

  async findAll() {
    const tenantId = this.prisma.requireTenantId();
    const menus = await this.prisma.menu.findMany({
      where: this.prisma.withTenantWhere({ deletedAt: null, isTenantGranted: true }),
      orderBy: { order: 'asc' },
      include: {
        parent: true,
        children: {
          where: { tenantId, deletedAt: null, isTenantGranted: true },
        },
        roles: {
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true },
        },
      },
    });

    // 构建树形结构
    const treeMenus = this.buildTree(menus);
    return Promise.all(treeMenus.map(menu => this.toMenuVo(menu)));
  }

  // 获取所有菜单（扁平化）
  async findAllFlat() {
    const menus = await this.prisma.menu.findMany({
      where: this.prisma.withTenantWhere({ deletedAt: null, isTenantGranted: true }),
      orderBy: { order: 'asc' },
      include: {
        parent: true,
      },
    });
    return Promise.all(menus.map(menu => this.toMenuVo(menu)));
  }

  async findOne(id: number) {
    const tenantId = this.prisma.requireTenantId();
    const menu = await this.prisma.menu.findFirst({
      where: this.prisma.withTenantWhere({ id, deletedAt: null, isTenantGranted: true }),
      include: {
        parent: true,
        children: {
          where: { tenantId, deletedAt: null, isTenantGranted: true },
        },
        roles: {
          where: { tenantId, deletedAt: null },
          select: { id: true, name: true },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException('菜单不存在');
    }

    return this.toMenuVo(menu);
  }

  async update(id: number, updateMenuDto: UpdateMenuDto) {
    const existingMenu = await this.prisma.menu.findFirst({
      where: this.prisma.withTenantWhere({ id, deletedAt: null, isTenantGranted: true }),
    });

    if (!existingMenu) {
      throw new NotFoundException('菜单不存在');
    }

    // 不能将父级设置为自己
    if (updateMenuDto.parentId === id) {
      throw new BadRequestException('父级菜单不能是自己');
    }

    await this.ensureTenantParent(updateMenuDto.parentId);
    const tenantId = this.prisma.requireTenantId();
    const updatedMenu = await this.prisma.menu.update({
      where: this.prisma.withTenantWhere({ id }),
      data: updateMenuDto,
      include: {
        parent: true,
        children: {
          where: { tenantId, deletedAt: null, isTenantGranted: true },
        },
      },
    });
    return this.toMenuVo(updatedMenu);
  }

  async remove(id: number) {
    const menu = await this.findOne(id);

    // 检查是否有子菜单（未软删除的）
    const childCount = await this.prisma.menu.count({
      where: this.prisma.withTenantWhere({ parentId: id, deletedAt: null, isTenantGranted: true }),
    });

    if (childCount > 0) {
      throw new BadRequestException('不能删除有子菜单的菜单');
    }

    // 软删除：更新 deletedAt 字段
    await this.prisma.menu.update({
      where: this.prisma.withTenantWhere({ id }),
      data: { deletedAt: new Date() },
    });

    return menu;
  }

  async removeMany(ids: number[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      return { count: 0, ids: [] };
    }

    const menus = await this.prisma.menu.findMany({
      where: this.prisma.withTenantWhere({ id: { in: uniqueIds }, deletedAt: null, isTenantGranted: true }),
    });

    if (menus.length !== uniqueIds.length) {
      throw new NotFoundException('部分菜单不存在或已删除');
    }

    const childCount = await this.prisma.menu.count({
      where: this.prisma.withTenantWhere({
        parentId: { in: uniqueIds },
        deletedAt: null,
        isTenantGranted: true,
        id: { notIn: uniqueIds },
      }),
    });

    if (childCount > 0) {
      throw new BadRequestException('不能删除存在子菜单的菜单');
    }

    const result = await this.prisma.menu.updateMany({
      where: this.prisma.withTenantWhere({ id: { in: uniqueIds }, deletedAt: null, isTenantGranted: true }),
      data: { deletedAt: new Date() },
    });

    return { count: result.count, ids: uniqueIds };
  }

  // 根据角色ID获取菜单
  async findMenusByRoleId(roleId: number) {
    const tenantId = this.prisma.requireTenantId();
    const role = await this.prisma.role.findFirst({
      where: this.prisma.withTenantWhere({ id: roleId, deletedAt: null }),
      include: {
        menus: {
          where: { tenantId, deletedAt: null, isTenantGranted: true },
          include: {
            children: {
              where: { tenantId, deletedAt: null, isTenantGranted: true },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('角色不存在');
    }

    const menus = role.menus;
    // 构建树形结构
    return this.buildTree(menus);
  }

  // 根据用户ID获取菜单
  async findMenusByUserId(userId: number) {
    const tenantId = this.prisma.requireTenantId();
    const user = await this.prisma.user.findFirst({
      where: this.prisma.withTenantWhere({ id: userId, deletedAt: null }),
      include: {
        roles: {
          where: { tenantId, deletedAt: null },
          include: {
            menus: {
              where: { tenantId, deletedAt: null, isTenantGranted: true },
              include: {
                children: {
                  where: { tenantId, deletedAt: null, isTenantGranted: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 获取所有角色的菜单并去重
    const menuSet = new Set<number>();
    const menus: any[] = [];

    for (const role of user.roles) {
      for (const menu of role.menus) {
        if (!menuSet.has(menu.id)) {
          menuSet.add(menu.id);
          menus.push(menu);
        }
      }
    }

    // 构建树形结构
    const treeMenus = this.buildTree(menus);
    return Promise.all(treeMenus.map(menu => this.toMenuVo(menu)));
  }

  // 构建树形结构
  private buildTree(menus: any[]): any[] {
    const menuMap = new Map<number, any>();
    const roots: any[] = [];

    // 先建立映射
    menus.forEach((menu) => {
      menuMap.set(menu.id, { ...menu, children: [] });
    });

    // 构建树
    menus.forEach((menu) => {
      const menuNode = menuMap.get(menu.id);
      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId);
        if (parent) {
          parent.children.push(menuNode);
        }
      } else {
        roots.push(menuNode);
      }
    });

    // 移除空数组字段
    const cleanMenu = (menu: any) => {
      if (menu.children.length === 0) {
        delete menu.children;
      } else {
        menu.children.forEach(cleanMenu);
      }
      // 移除不需要的字段
      delete menu.parent;
    };

    roots.forEach(cleanMenu);

    return roots;
  }

  private async toMenuVo(entity: any): Promise<MenuVo> {
    const children = entity.children?.length
      ? await Promise.all(entity.children.map((child: any) => this.toMenuVo(child)))
      : undefined;

    return MenuVo.fromEntity({
      ...entity,
      iconUrl: await this.iconAssetsService.resolveIconUrl(entity.icon),
      children,
    });
  }

  private async ensureTenantParent(parentId?: number | null) {
    if (!parentId) {
      return;
    }

    const parent = await this.prisma.menu.findFirst({
      where: this.prisma.withTenantWhere({
        id: parentId,
        deletedAt: null,
        isTenantGranted: true,
      }),
    });

    if (!parent) {
      throw new NotFoundException('父级菜单不存在');
    }
  }
}
