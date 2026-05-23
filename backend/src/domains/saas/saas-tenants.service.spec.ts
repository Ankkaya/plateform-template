import { NotFoundException } from '@nestjs/common';
import { SaasTenantsService } from './saas-tenants.service';

describe('SaasTenantsService tenant menu grants', () => {
  function createService(options?: { menuCount?: number }) {
    const tx = {
      menu: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, parentId: null, name: '系统管理', isTenantGranted: true },
          { id: 2, parentId: 1, name: '用户管理', isTenantGranted: true },
          { id: 3, parentId: 1, name: '菜单管理', isTenantGranted: false },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([
          { id: 10, menus: [{ id: 3 }] },
        ]),
        update: jest.fn().mockResolvedValue({ id: 10 }),
      },
    };
    const prisma = {
      tenant: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, deletedAt: null }),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      menu: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, parentId: null, name: '系统管理', isTenantGranted: true },
          { id: 2, parentId: 1, name: '用户管理', isTenantGranted: true },
          { id: 3, parentId: 1, name: '菜单管理', isTenantGranted: false },
        ]),
        count: jest.fn().mockResolvedValue(options?.menuCount ?? 1),
      },
      $transaction: jest.fn(async (callback) => callback(tx)),
    };

    return {
      service: new SaasTenantsService(prisma as any, {} as any),
      prisma,
      tx,
    };
  }

  it('updates the tenant menu grant ceiling and disconnects revoked menus from tenant roles', async () => {
    const { service, tx } = createService();

    await service.updateMenuGrants(1, [2]);

    expect(tx.menu.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 1, deletedAt: null },
      data: { isTenantGranted: false },
    });
    expect(tx.menu.updateMany).toHaveBeenCalledWith({
      where: { tenantId: 1, id: { in: [1, 2] }, deletedAt: null },
      data: { isTenantGranted: true },
    });
    expect(tx.role.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        menus: {
          disconnect: [{ id: 3 }],
        },
      },
    });
  });

  it('rejects menu grant updates with menu ids outside the tenant', async () => {
    const { service, prisma } = createService({ menuCount: 0 });

    await expect(service.updateMenuGrants(1, [99])).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
