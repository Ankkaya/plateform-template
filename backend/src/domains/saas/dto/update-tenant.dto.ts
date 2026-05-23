import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: '演示租户', description: '租户名称' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: true, description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: '张三', description: '联系人' })
  @IsString()
  @IsOptional()
  contactName?: string | null;

  @ApiPropertyOptional({ example: 'tenant@example.com', description: '联系人邮箱' })
  @IsEmail()
  @IsOptional()
  contactEmail?: string | null;

  @ApiPropertyOptional({ example: '13800000000', description: '联系人电话' })
  @IsString()
  @IsOptional()
  contactPhone?: string | null;

  @ApiPropertyOptional({ example: '备注', description: '租户备注' })
  @IsString()
  @IsOptional()
  remark?: string | null;
}
