import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { TenantBootstrapService } from './tenant-bootstrap.service';
import { toTenantVo } from './saas-presenter';

type TenantMenuGrant = {
  id: number;
  parentId: number | null;
  order: number;
  isTenantGranted: boolean;
};

@Injectable()
export class SaasTenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantBootstrap: TenantBootstrapService,
  ) {}

  create(dto: CreateTenantDto) {
    return this.tenantBootstrap.createTenant(dto);
  }

  async findAll() {
    const tenants = await this.prisma.tenant.findMany({
      where: { deletedAt: null },
      include: { subscription: { include: { plan: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return tenants.map(toTenantVo);
  }

  async findOne(id: number) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      include: { subscription: { include: { plan: true } } },
    });
    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }
    return toTenantVo(tenant);
  }

  async findMenus(id: number) {
    await this.ensureTenantExists(id);
    const menus = await this.prisma.menu.findMany({
      where: { tenantId: id, deletedAt: null },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    return this.buildMenuTree(menus);
  }

  async updateMenuGrants(id: number, menuIds: number[]) {
    await this.ensureTenantExists(id);
    const uniqueIds = Array.from(new Set(menuIds));
    const tenantMenus = await this.prisma.menu.findMany({
      where: { tenantId: id, deletedAt: null },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });

    const menuById = new Map<number, TenantMenuGrant>(
      tenantMenus.map((menu) => [menu.id, menu]),
    );
    const invalidMenuId = uniqueIds.find((menuId) => !menuById.has(menuId));
    if (invalidMenuId !== undefined) {
      throw new NotFoundException('部分菜单不存在或不属于该租户');
    }

    const grantedMenuIds = this.expandMenuIdsWithAncestors(uniqueIds, menuById);
    const updatedMenus = await this.prisma.$transaction(async (tx) => {
      await tx.menu.updateMany({
        where: { tenantId: id, deletedAt: null },
        data: { isTenantGranted: false },
      });

      if (grantedMenuIds.length > 0) {
        await tx.menu.updateMany({
          where: { tenantId: id, id: { in: grantedMenuIds }, deletedAt: null },
          data: { isTenantGranted: true },
        });
      }

      const rolesWithRevokedMenus = await tx.role.findMany({
        where: { tenantId: id, deletedAt: null },
        include: {
          menus: {
            where: { tenantId: id, id: { notIn: grantedMenuIds }, deletedAt: null },
            select: { id: true },
          },
        },
      });

      await Promise.all(
        rolesWithRevokedMenus
          .filter((role) => role.menus.length > 0)
          .map((role) => tx.role.update({
            where: { id: role.id },
            data: {
              menus: {
                disconnect: role.menus.map((menu) => ({ id: menu.id })),
              },
            },
          })),
      );

      return tx.menu.findMany({
        where: { tenantId: id, deletedAt: null },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      });
    });

    return this.buildMenuTree(updatedMenus);
  }

  async update(id: number, dto: UpdateTenantDto) {
    await this.findOne(id);
    const tenant = await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isEnabled !== undefined ? {
          isEnabled: dto.isEnabled,
          status: dto.isEnabled ? 'ACTIVE' : 'DISABLED',
        } : {}),
        ...(dto.contactName !== undefined ? { contactName: dto.contactName?.trim() || null } : {}),
        ...(dto.contactEmail !== undefined ? { contactEmail: dto.contactEmail?.trim() || null } : {}),
        ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone?.trim() || null } : {}),
        ...(dto.remark !== undefined ? { remark: dto.remark?.trim() || null } : {}),
      },
      include: { subscription: { include: { plan: true } } },
    });
    return toTenantVo(tenant);
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.tenant.update({
      where: { id },
      data: {
        isEnabled: false,
        status: 'DISABLED',
        deletedAt: new Date(),
      },
    });
    return { id };
  }

  private async ensureTenantExists(id: number) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException('租户不存在');
    }
  }

  private expandMenuIdsWithAncestors(
    menuIds: number[],
    menuById: Map<number, TenantMenuGrant>,
  ) {
    const result = new Set<number>();

    for (const menuId of menuIds) {
      let current = menuById.get(menuId);
      while (current) {
        result.add(current.id);
        current = current.parentId ? menuById.get(current.parentId) : undefined;
      }
    }

    return Array.from(result).sort((a, b) => a - b);
  }

  private buildMenuTree<T extends { id: number; parentId: number | null }>(menus: T[]) {
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
}
