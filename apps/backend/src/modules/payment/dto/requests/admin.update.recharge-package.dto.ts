import { ApiPropertyOptional, PartialType } from '@nestjs/swagger'
import { AdminCreateRechargePackageDto } from './admin.create.recharge-package.dto'
import { IsEnum, IsOptional, IsString, MinLength, MaxLength, Matches, IsObject } from 'class-validator'
import { RechargePackageStatus } from '@prisma/client'

export class AdminUpdateRechargePackageDto extends PartialType(AdminCreateRechargePackageDto) {
  @ApiPropertyOptional({
    description: '套餐状态',
    enum: RechargePackageStatus,
    example: RechargePackageStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(RechargePackageStatus)
  status?: RechargePackageStatus

  @ApiPropertyOptional({
    description: '内部名称（备用字段，覆盖 PartialType 默认校验）',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name?: string

  @ApiPropertyOptional({
    description: '显示标题',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  displayTitle?: string

  @ApiPropertyOptional({
    description: '徽标文案',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  badgeLabel?: string

  @ApiPropertyOptional({
    description: '价格金额（字符串，最多两位小数）',
  })
  @IsOptional()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: '价格金额格式不合法，最多支持两位小数',
  })
  priceAmount?: string

  @ApiPropertyOptional({
    description: '价格币种（ISO 4217）',
  })
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, { message: '价格币种必须是 3 位大写字母' })
  priceCurrency?: string

  @ApiPropertyOptional({
    description: '自定义元数据（JSON）',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
