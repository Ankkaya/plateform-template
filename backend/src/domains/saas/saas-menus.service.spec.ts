import { NotFoundException } from '@nestjs/common';
import { SaasMenusService } from './saas-menus.service';

describe('SaasMenusService', () => {
  function createService(options?: { parentFound?: boolean; tenantFound?: boolean }) {
    const prisma = {
      tenant: {
        findFirst: jest.fn().mockResolvedValue(
          options?.tenantFound === false ? null : { id: 1 },
        ),
      },
      menu: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(
          options?.parentFound === false ? null : { id: 2, tenantId: 1 },
        ),
        create: jest.fn().mockResolvedValue({
          id: 10,
          tenantId: 1,
          name: '业务菜单',
          path: '/business',
          parentId: 2,
          order: 1,
          hidden: false,
          type: 'menu',
          isTenantGranted: true,
        }),
      },
    };
    const iconAssetsService = {
      resolveIconUrl: jest.fn().mockResolvedValue(null),
    };

    return {
      service: new SaasMenusService(prisma as any, iconAssetsService as any),
      prisma,
    };
  }

  it('lists global system menus without a selected tenant id', async () => {
    const { service, prisma } = createService();

    await service.findAll();

    expect(prisma.menu.findMany).toHaveBeenCalledWith({
      where: { tenantId: 1, deletedAt: null },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
  });

  it('creates a global system menu from the platform context without an explicit tenant id', async () => {
    const { service, prisma } = createService();

    await service.create({
      name: '业务菜单',
      path: '/business',
      parentId: 2,
      order: 1,
      type: 'menu',
    });

    expect(prisma.menu.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 1,
        name: '业务菜单',
        parentId: 2,
        isTenantGranted: true,
      }),
    });
  });

  it('rejects parent menus outside the global system menu catalog', async () => {
    const { service, prisma } = createService({ parentFound: false });

    await expect(service.create({
      name: '业务菜单',
      parentId: 99,
      type: 'menu',
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.menu.create).not.toHaveBeenCalled();
  });
});
