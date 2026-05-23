import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { RedisService } from '@/infrastructure/redis/redis.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import * as bcrypt from 'bcrypt';

type PlatformTokenPayload = {
  sub: number;
  platform: true;
};

type PlatformUserEntity = {
  id: number;
  username: string;
  password: string;
  name?: string | null;
  email?: string | null;
  isEnabled: boolean;
  isSuperAdmin: boolean;
  permissions: unknown;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const user = await this.prisma.platformUser.findFirst({
      where: {
        username: dto.username,
        deletedAt: null,
      },
    }) as PlatformUserEntity | null;

    const passwordValid = !!user && user.isEnabled && await bcrypt.compare(dto.password, user.password);
    if (!user || !passwordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const token = this.generateToken(user.id);
    await this.redis.setPlatformToken(user.id, token, this.getTokenTtlSeconds(token), 'access');

    return {
      user: this.toSafeUser(user),
      token,
    };
  }

  async logout(userId: number) {
    await this.redis.deletePlatformUserTokens(userId);
    return { success: true };
  }

  generateToken(userId: number): string {
    const payload: PlatformTokenPayload = {
      sub: userId,
      platform: true,
    };
    return this.jwtService.sign(payload);
  }

  toSafeUser(user: PlatformUserEntity) {
    return {
      id: user.id,
      username: user.username,
      name: user.name ?? null,
      email: user.email ?? null,
      isEnabled: user.isEnabled,
      isSuperAdmin: user.isSuperAdmin,
      permissions: this.normalizePermissions(user.permissions),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private normalizePermissions(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private getTokenTtlSeconds(token: string): number {
    const payload = this.jwtService.decode(token) as { exp?: number } | null;
    if (!payload?.exp) {
      throw new InternalServerErrorException('令牌缺少过期时间');
    }
    return Math.max(1, payload.exp - Math.floor(Date.now() / 1000));
  }
}
