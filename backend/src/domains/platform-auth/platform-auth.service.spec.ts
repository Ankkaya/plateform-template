import { UnauthorizedException } from '@nestjs/common';
import { PlatformAuthService } from './platform-auth.service';

describe('PlatformAuthService', () => {
  function createService() {
    const user = {
      id: 1,
      username: 'platform_admin',
      password: 'hashed-secret',
      name: '平台管理员',
      email: 'platform@example.com',
      isEnabled: true,
      isSuperAdmin: true,
      permissions: ['platform:*'],
      deletedAt: null,
    };
    const prisma = {
      platformUser: {
        findFirst: jest.fn().mockResolvedValue(user),
      },
    };
    const jwtService = {
      sign: jest.fn().mockReturnValue('platform-access-token'),
      decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    };
    const redis = {
      setPlatformToken: jest.fn().mockResolvedValue(undefined),
      deletePlatformUserTokens: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PlatformAuthService(prisma as any, jwtService as any, redis as any);

    return { service, prisma, jwtService, redis };
  }

  it('logs in an enabled platform user and caches the platform token', async () => {
    const { service, jwtService, redis } = createService();
    const compareSpy = jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);

    const result = await service.login({ username: 'platform_admin', password: 'secret' });

    expect(result).toMatchObject({
      token: 'platform-access-token',
      user: {
        id: 1,
        username: 'platform_admin',
        isSuperAdmin: true,
      },
    });
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 1, platform: true });
    expect(redis.setPlatformToken).toHaveBeenCalledWith(
      1,
      'platform-access-token',
      expect.any(Number),
      'access',
    );
    expect(JSON.stringify(result)).not.toContain('hashed-secret');

    compareSpy.mockRestore();
  });

  it('rejects disabled platform users', async () => {
    const { service, prisma } = createService();
    prisma.platformUser.findFirst.mockResolvedValueOnce({
      username: 'disabled',
      password: 'hashed-secret',
      isEnabled: false,
      deletedAt: null,
    });

    await expect(service.login({ username: 'disabled', password: 'secret' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
