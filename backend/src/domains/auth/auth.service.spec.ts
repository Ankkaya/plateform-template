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
      decode: jest.fn((token: string) => {
        return token.startsWith('refresh-')
          ? { exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 }
          : { exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 };
      }),
      verifyAsync: jest.fn().mockResolvedValue({ sub: user.id }),
    };
    const prisma = {
      loginLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const redis = {
      setToken: jest.fn().mockResolvedValue(undefined),
      validateToken: jest.fn().mockResolvedValue(true),
      deleteUserTokens: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AuthService(
      usersService as any,
      jwtService as any,
      {} as any,
      {} as any,
      prisma as any,
      redis as any,
    );

    return { service, usersService, jwtService, prisma, redis };
  }

  it('returns an access token and refresh token after registration', async () => {
    const { service, redis } = createService();

    const result = await service.register({
      username: 'admin',
      password: 'secret',
    });

    expect(result).toMatchObject({
      user,
      token: 'access-1',
      refreshToken: 'refresh-1',
    });
    expect(redis.setToken).toHaveBeenNthCalledWith(1, 1, 'access-1', expect.any(Number), 'access');
    expect(redis.setToken).toHaveBeenNthCalledWith(2, 1, 'refresh-1', expect.any(Number), 'refresh');
  });

  it('issues a new token pair and logs a successful refresh', async () => {
    const { service, usersService, prisma, redis } = createService();

    const result = await service.refresh('valid-refresh-token', '127.0.0.1', 'test-agent');

    expect(redis.validateToken).toHaveBeenCalledWith(1, 'valid-refresh-token', 'refresh');
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

  it('rejects a refresh token when it is no longer cached in redis', async () => {
    const { service, redis, prisma } = createService();
    redis.validateToken.mockResolvedValueOnce(false);

    await expect(service.refresh('stale-refresh-token', '127.0.0.1')).rejects.toBeInstanceOf(
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
  });

  it('clears cached tokens on logout', async () => {
    const { service, redis } = createService();

    await expect(service.logout(1)).resolves.toEqual({ success: true });
    expect(redis.deleteUserTokens).toHaveBeenCalledWith(1);
  });
});
