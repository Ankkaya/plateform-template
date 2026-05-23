import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { IconAssetsService } from '@/infrastructure/icon-assets/icon-assets.service';
import { CreateMenuDto } from '@/domains/menus/dto/create-menu.dto';
import { UpdateMenuDto } from '@/domains/menus/dto/update-menu.dto';
import { MenuVo } from '@/menus/vo';

const SYSTEM_MENU_TENANT_ID = 1;

@Injectable()
export class SaasMenusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly iconAssetsService: IconAssetsService,
  ) {}

  async findAll(format?: string) {
    const menus = await this.prisma.menu.findMany({
      where: { tenantId: SYSTEM_MENU_TENANT_ID, deletedAt: null },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    const result = format === 'flat' ? menus : this.buildTree(menus);
    return Promise.all(result.map(menu => this.toMenuVo(menu)));
  }

  async findOne(id: number) {
    const menu = await this.prisma.menu.findFirst({
      where: { id, deletedAt: null },
    });
    if (!menu) {
      throw new NotFoundException('菜单不存在');
    }
    return this.toMenuVo(menu);
  }

  async create(dto: CreateMenuDto) {
    await this.ensureSystemMenuTenantExists();
    await this.ensureSystemMenuParent(dto.parentId);

    const data = this.normalizeMenuData(dto);
    const menu = await this.prisma.menu.create({
      data: {
        ...data,
        name: dto.name.trim(),
        tenantId: SYSTEM_MENU_TENANT_ID,
        isTenantGranted: true,
      },
    });
    return this.toMenuVo(menu);
  }

  async update(id: number, dto: UpdateMenuDto) {
    const existingMenu = await this.prisma.menu.findFirst({
      where: { id, tenantId: SYSTEM_MENU_TENANT_ID, deletedAt: null },
    });
    if (!existingMenu) {
      throw new NotFoundException('菜单不存在');
    }
    if (dto.parentId === id) {
      throw new BadRequestException('父级菜单不能是自己');
    }

    await this.ensureSystemMenuParent(dto.parentId);
    const menu = await this.prisma.menu.update({
      where: { id },
      data: this.normalizeMenuData(dto),
    });
    return this.toMenuVo(menu);
  }

  async remove(id: number) {
    const menu = await this.prisma.menu.findFirst({
      where: { id, tenantId: SYSTEM_MENU_TENANT_ID, deletedAt: null },
    });
    if (!menu) {
      throw new NotFoundException('菜单不存在');
    }

    const childCount = await this.prisma.menu.count({
      where: { tenantId: SYSTEM_MENU_TENANT_ID, parentId: id, deletedAt: null },
    });
    if (childCount > 0) {
      throw new BadRequestException('不能删除有子菜单的菜单');
    }

    await this.prisma.menu.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return this.toMenuVo(menu);
  }

  async removeMany(ids: number[]) {
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      return { count: 0, ids: [] };
    }

    const menus = await this.prisma.menu.findMany({
      where: { id: { in: uniqueIds }, tenantId: SYSTEM_MENU_TENANT_ID, deletedAt: null },
      select: { id: true },
    });
    if (menus.length !== uniqueIds.length) {
      throw new NotFoundException('部分菜单不存在或已删除');
    }

    const childCount = await this.prisma.menu.count({
      where: {
        tenantId: SYSTEM_MENU_TENANT_ID,
        parentId: { in: uniqueIds },
        id: { notIn: uniqueIds },
        deletedAt: null,
      },
    });
    if (childCount > 0) {
      throw new BadRequestException('不能删除存在子菜单的菜单');
    }

    const result = await this.prisma.menu.updateMany({
      where: { id: { in: uniqueIds }, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return { count: result.count, ids: uniqueIds };
  }

  private normalizeMenuData(dto: CreateMenuDto | UpdateMenuDto) {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.path !== undefined ? { path: dto.path?.trim() || null } : {}),
      ...(dto.icon !== undefined ? { icon: dto.icon?.trim() || null } : {}),
      ...(dto.component !== undefined ? { component: dto.component?.trim() || null } : {}),
      ...(dto.redirect !== undefined ? { redirect: dto.redirect?.trim() || null } : {}),
      ...(dto.permission !== undefined ? { permission: dto.permission?.trim() || null } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId ?? null } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
      ...(dto.hidden !== undefined ? { hidden: dto.hidden } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
    };
  }

  private async ensureSystemMenuTenantExists() {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: SYSTEM_MENU_TENANT_ID, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('系统菜单租户不存在');
    }
  }

  private async ensureSystemMenuParent(parentId?: number | null) {
    if (!parentId) {
      return;
    }

    const parent = await this.prisma.menu.findFirst({
      where: { id: parentId, tenantId: SYSTEM_MENU_TENANT_ID, deletedAt: null },
    });
    if (!parent) {
      throw new NotFoundException('父级菜单不存在');
    }
  }

  private buildTree<T extends { id: number; parentId: number | null }>(menus: T[]) {
    const menuMap = new Map<number, T & { children?: T[] }>();
    const roots: Array<T & { children?: T[] }> = [];

    for (const menu of menus) {
      menuMap.set(menu.id, { ...menu, children: [] });
    }

    for (const menu of menus) {
      const node = menuMap.get(menu.id);
      if (!node) continue;
      if (menu.parentId) {
        const parent = menuMap.get(menu.parentId);
        if (parent) {
          parent.children?.push(node);
          continue;
        }
      }
      roots.push(node);
    }

    const cleanMenu = (menu: T & { children?: T[] }) => {
      if (!menu.children?.length) {
        delete menu.children;
        return;
      }
      menu.children.forEach((child) => cleanMenu(child as T & { children?: T[] }));
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
}
