import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { PlatformAuthService } from '../platform-auth.service';

type PlatformAuthRequest = {
  headers?: {
    authorization?: string;
  };
};

@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly platformAuth: PlatformAuthService,
  ) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(req: PlatformAuthRequest, payload: { sub: number; platform?: boolean }) {
    if (!payload.platform) {
      throw new UnauthorizedException('平台令牌无效');
    }

    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token) {
      throw new UnauthorizedException();
    }

    const isValid = await this.redis.validatePlatformToken(payload.sub, token, 'access');
    if (!isValid) {
      throw new UnauthorizedException('平台访问令牌无效或已失效');
    }

    const user = await this.prisma.platformUser.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
        isEnabled: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('平台用户不存在或已停用');
    }

    return {
      ...this.platformAuth.toSafeUser(user),
      sub: payload.sub,
      userId: payload.sub,
    };
  }
}
