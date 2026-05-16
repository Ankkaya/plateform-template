import { UnauthorizedException } from '@nestjs/common';
import { LoginLogType } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService refresh tokens', () => {
  const user = {
    id: 1,
    username: 'admin',
    email: null,
    name: '管理员',
    avatarUrl: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    roles: [],
  };

  function createService() {
    const usersService = {
      create: jest.fn().mockResolvedValue(user),
      findById: jest.fn().mockResolvedValue(user),
    };
    const jwtService = {
      sign: jest.fn((payload: { sub: number }, options?: { secret?: string }) => {
        return options?.secret ? `refresh-${payload.sub}` : `access-${payload.sub}`;
      }),
      verifyAsync: jest.fn().mockResolvedValue({ sub: user.id }),
    };
    const prisma = {
      loginLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const service = new AuthService(
      usersService as any,
      jwtService as any,
      {} as any,
      {} as any,
      prisma as any,
    );

    return { service, usersService, jwtService, prisma };
  }

  it('returns an access token and refresh token after registration', async () => {
    const { service } = createService();

    const result = await service.register({
      username: 'admin',
      password: 'secret',
    });

    expect(result).toMatchObject({
      user,
      token: 'access-1',
      refreshToken: 'refresh-1',
    });
  });

  it('issues a new token pair and logs a successful refresh', async () => {
    const { service, usersService, prisma } = createService();

    const result = await service.refresh('valid-refresh-token', '127.0.0.1', 'test-agent');

    expect(usersService.findById).toHaveBeenCalledWith(user.id);
    expect(result).toMatchObject({
      user,
      token: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(prisma.loginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        username: user.username,
        type: LoginLogType.REFRESH,
        ip: '127.0.0.1',
        userAgent: 'test-agent',
        success: true,
      }),
    });
  });

  it('logs a failed refresh without exposing the token value', async () => {
    const { service, jwtService, prisma } = createService();
    jwtService.verifyAsync.mockRejectedValueOnce(new Error('expired token value'));

    await expect(service.refresh('expired-refresh-token', '127.0.0.1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(prisma.loginLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: LoginLogType.REFRESH,
        ip: '127.0.0.1',
        success: false,
        message: '刷新令牌无效或已过期',
      }),
    });
    expect(JSON.stringify(prisma.loginLog.create.mock.calls)).not.toContain(
      'expired-refresh-token',
    );
  });
});
