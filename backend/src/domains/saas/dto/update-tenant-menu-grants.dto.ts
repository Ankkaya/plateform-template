import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class UpdateTenantMenuGrantsDto {
  @ApiProperty({ example: [1, 10, 100], description: '平台同步到租户的菜单/按钮权限 ID 列表', type: [Number] })
  @IsArray()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  menuIds: number[];
}
