import { UsersService } from './users.service';

describe('UsersService.update avatarUrl', () => {
  const now = new Date('2026-05-18T00:00:00.000Z');
  const role = {
    id: 1,
    name: '管理员',
    code: 'admin',
    description: null,
    createdAt: now,
    updatedAt: now,
  };

  function createService() {
    const prisma = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const service = new UsersService(prisma as any, {} as any);

    return { service, prisma };
  }

  it('persists avatarUrl when updating a user profile', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 1,
      email: 'old@example.com',
      deletedAt: null,
    });
    prisma.user.update.mockResolvedValueOnce({
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      name: '管理员',
      avatarUrl: 'http://example.com/avatar.png',
      createdAt: now,
      updatedAt: now,
      roles: [role],
    });

    const result = await service.update(1, {
      email: 'admin@example.com',
      name: '管理员',
      avatarUrl: 'http://example.com/avatar.png',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        email: 'admin@example.com',
        name: '管理员',
        avatarUrl: 'http://example.com/avatar.png',
      }),
      include: {
        roles: true,
      },
    });
    expect(result).toMatchObject({
      id: 1,
      avatarUrl: 'http://example.com/avatar.png',
      roles: [{ code: 'admin' }],
    });
  });

  it('allows clearing avatarUrl with null', async () => {
    const { service, prisma } = createService();
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 1,
      email: 'admin@example.com',
      deletedAt: null,
    });
    prisma.user.update.mockResolvedValueOnce({
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      name: '管理员',
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
      roles: [role],
    });

    const result = await service.update(1, {
      avatarUrl: null,
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        avatarUrl: null,
      }),
      include: {
        roles: true,
      },
    });
    expect(result.avatarUrl).toBeNull();
  });
});
