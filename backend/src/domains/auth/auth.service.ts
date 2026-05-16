import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { CryptoKeysService } from './services/crypto-keys.service';
import { LoginThrottleService } from './services/login-throttle.service';
import { PrismaService } from '@/infrastructure/prisma/prisma.service';
import { LoginLogType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private readonly cryptoKeys: CryptoKeysService,
    private readonly loginThrottle: LoginThrottleService,
    private readonly prisma: PrismaService,
  ) {}

  async register(createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return { user, ...this.generateAuthTokens(user.id) };
  }

  async login(loginDto: LoginDto, ip = 'unknown', userAgent?: string) {
    const username = loginDto.username;

    // ① 锁定校验：超过失败阈值则直接拒绝
    await this.loginThrottle.assertNotLocked(username, ip);

    // ② RSA 解密前端密文 → 明文密码
    const plainPassword = this.cryptoKeys.decryptLoginPayload(loginDto.password);

    // ③ 用户/密码校验（保持「用户名或密码错误」统一文案，避免泄露用户存在性）
    const user = await this.usersService.findByUsername(username);
    const isPasswordValid =
      !!user && (await bcrypt.compare(plainPassword, user.password));

    if (!user || !isPasswordValid) {
      const failCount = await this.loginThrottle.recordFailure(username, ip);
      const hint = failCount > 0 ? `（已失败 ${failCount} 次）` : '';
      // 记录登录失败日志
      await this.prisma.loginLog.create({
        data: {
          userId: user?.id,
          username,
          type: LoginLogType.LOGIN,
          ip,
          userAgent: userAgent || '',
          success: false,
          message: `用户名或密码错误${hint}`,
        },
      });
      throw new UnauthorizedException(`用户名或密码错误${hint}`);
    }

    // ④ 登录成功 → 清零计数
    await this.loginThrottle.reset(username, ip);

    const { password, ...result } = user;

    // 记录登录成功日志
    await this.prisma.loginLog.create({
      data: {
        userId: user.id,
        username: user.username,
        type: LoginLogType.LOGIN,
        ip,
        userAgent: userAgent || '',
        success: true,
      },
    });

    return { user: result, ...this.generateAuthTokens(user.id) };
  }

  generateToken(userId: number): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload);
  }

  generateRefreshToken(userId: number): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-secret-key',
      expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '30d') as any,
    });
  }

  generateAuthTokens(userId: number) {
    return {
      token: this.generateToken(userId),
      refreshToken: this.generateRefreshToken(userId),
    };
  }

  async verifyRefreshToken(refreshToken: string): Promise<{ sub: number }> {
    try {
      return await this.jwtService.verifyAsync(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'your-secret-key',
      });
    }
    catch {
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }
  }

  async verifyAccessToken(token: string): Promise<{ sub: number }> {
    try {
      return await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      });
    }
    catch {
      throw new UnauthorizedException('访问令牌无效或已过期');
    }
  }

  async refresh(refreshToken: string, ip = 'unknown', userAgent?: string) {
    let payload: { sub: number };

    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      await this.prisma.loginLog.create({
        data: {
          type: LoginLogType.REFRESH,
          ip,
          userAgent: userAgent || '',
          success: false,
          message: '刷新令牌无效或已过期',
        },
      });
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }

    let user: Awaited<ReturnType<UsersService['findById']>>;
    try {
      user = await this.usersService.findById(payload.sub);
    } catch {
      await this.prisma.loginLog.create({
        data: {
          userId: payload.sub,
          type: LoginLogType.REFRESH,
          ip,
          userAgent: userAgent || '',
          success: false,
          message: '用户不存在或已停用',
        },
      });
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }

    await this.prisma.loginLog.create({
      data: {
        userId: user.id,
        username: user.username,
        type: LoginLogType.REFRESH,
        ip,
        userAgent: userAgent || '',
        success: true,
      },
    });

    return { user, ...this.generateAuthTokens(user.id) };
  }
}
