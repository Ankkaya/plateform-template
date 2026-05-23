import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class PlatformLoginDto {
  @ApiProperty({ example: 'platform_admin', description: '平台运营员用户名' })
  @IsString()
  @MinLength(2)
  username: string;

  @ApiProperty({ example: '123456', description: '平台运营员密码' })
  @IsString()
  @MinLength(6)
  password: string;
}
