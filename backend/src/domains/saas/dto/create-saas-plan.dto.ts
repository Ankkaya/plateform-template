import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSaasPlanDto {
  @ApiProperty({ example: '专业版', description: '套餐名称' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'plan_a1b2c3d4', description: '套餐编码；未传时由系统自动生成' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: '适合中小团队', description: '套餐说明' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 9900, description: '价格，单位分；前端以元展示并转换为分提交' })
  @IsInt()
  @Min(0)
  @IsOptional()
  priceCents?: number;

  @ApiPropertyOptional({ example: 50, description: '用户数上限，空值表示不限' })
  @IsInt()
  @Min(1)
  @IsOptional()
  userLimit?: number | null;

  @ApiPropertyOptional({ example: 10240, description: '存储空间上限，单位 MB，空值表示不限' })
  @IsInt()
  @Min(1)
  @IsOptional()
  storageLimitMb?: number | null;

  @ApiPropertyOptional({ example: 365, description: '订阅天数' })
  @IsInt()
  @Min(1)
  durationDays: number;

  @ApiPropertyOptional({ example: true, description: '是否启用' })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;

  @ApiPropertyOptional({ example: 1, description: '排序' })
  @IsInt()
  @Min(0)
  @IsOptional()
  sort?: number;
}
