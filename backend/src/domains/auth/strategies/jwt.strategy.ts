import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { TenantContextService } from '@/common/tenant/tenant-context.service';
import { TenantAccessService } from '@/domains/saas/tenant-access.service';

type AuthRequest = {
  headers?: {
    authorization?: string;
  };
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private usersService: UsersService,
    private readonly redis: RedisService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantAccess: TenantAccessService,
  ) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(req: AuthRequest, payload: { sub: number; tenantId: number }) {
    const token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
    if (!token) {
      throw new UnauthorizedException();
    }

    const tenantId = this.tenantContext.requireTenantId();
    if (!payload.tenantId || payload.tenantId !== tenantId) {
      throw new UnauthorizedException('访问令牌租户无效');
    }

    try {
      await this.tenantAccess.assertTenantUsable(tenantId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '租户不可用';
      throw new UnauthorizedException(message);
    }

    const isValid = await this.redis.validateToken(tenantId, payload.sub, token, 'access');
    if (!isValid) {
      throw new UnauthorizedException('访问令牌无效或已失效');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      ...user,
      sub: payload.sub,
      userId: payload.sub,
    };
  }
}
