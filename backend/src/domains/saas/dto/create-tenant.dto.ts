import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: '演示租户', description: '租户名称' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: '张三', description: '联系人' })
  @IsString()
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional({ example: 'tenant@example.com', description: '联系人邮箱' })
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional({ example: '13800000000', description: '联系人电话' })
  @IsString()
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({ example: '备注', description: '租户备注' })
  @IsString()
  @IsOptional()
  remark?: string;

  @ApiProperty({ example: 1, description: '套餐 ID' })
  @IsInt()
  @Min(1)
  planId: number;

  @ApiProperty({ example: 'admin', description: '初始租户管理员用户名' })
  @IsString()
  @MinLength(3)
  adminUsername: string;

  @ApiProperty({ example: '123456', description: '初始租户管理员密码' })
  @IsString()
  @MinLength(6)
  adminPassword: string;

  @ApiPropertyOptional({ example: '租户管理员', description: '初始管理员姓名' })
  @IsString()
  @IsOptional()
  adminName?: string;

  @ApiPropertyOptional({ example: 'admin@tenant.local', description: '初始管理员邮箱' })
  @IsEmail()
  @IsOptional()
  adminEmail?: string;
}
