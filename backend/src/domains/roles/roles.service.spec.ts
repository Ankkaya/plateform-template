import { ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';

describe('RolesService tenant menu grant ceiling', () => {
  function createService() {
    const prisma = {
      requireTenantId: jest.fn().mockReturnValue(1),
      withTenantWhere: jest.fn((where = {}) => ({ ...where, tenantId: 1 })),
      withTenantData: jest.fn((data) => ({ ...data, tenantId: 1 })),
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, code: 'operator' }),
        update: jest.fn().mockResolvedValue({ id: 1, menus: [] }),
      },
      menu: {
        count: jest
          .fn()
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1),
      },
    };

    return {
      service: new RolesService(prisma as any),
      prisma,
    };
  }

  it('rejects assigning menus that are not synchronized by the platform tenant ceiling', async () => {
    const { service, prisma } = createService();

    await expect(service.assignMenus(1, [10, 11])).rejects.toThrow('不能分配未同步到租户的菜单权限');

    expect(prisma.menu.count).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        id: { in: [10, 11] },
        isTenantGranted: true,
        deletedAt: null,
        tenantId: 1,
      }),
    });
    expect(prisma.role.update).not.toHaveBeenCalled();
  });
});
