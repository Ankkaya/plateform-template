import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { CryptoKeysService } from '../auth/services/crypto-keys.service';

@ApiTags('平台接口/平台认证')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(
    private readonly platformAuthService: PlatformAuthService,
    private readonly cryptoKeys: CryptoKeysService,
  ) {}

  @Get('public-key')
  @ApiOperation({ summary: '获取平台登录密码加密公钥（RSA-2048，PKCS1）' })
  getPublicKey() {
    return this.cryptoKeys.getPublicKey();
  }

  @Post('login')
  @ApiOperation({ summary: '平台运营员登录' })
  login(@Body() dto: PlatformLoginDto) {
    return this.platformAuthService.login(dto);
  }

  @Get('me')
  @UseGuards(PlatformJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前平台运营员' })
  me(@Request() req) {
    return req.user;
  }

  @Post('logout')
  @UseGuards(PlatformJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '平台运营员退出登录' })
  logout(@Request() req) {
    return this.platformAuthService.logout(req.user.userId);
  }
}
