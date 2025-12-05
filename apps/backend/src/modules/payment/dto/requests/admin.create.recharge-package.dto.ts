import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  MaxLength,
  IsObject,
} from 'class-validator'
import { Type } from 'class-transformer'

export class AdminCreateRechargePackageDto {
  @ApiProperty({ description: '内部名称', example: 'entry_pack' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name: string

  @ApiProperty({ description: '展示标题', example: '入门套餐' })
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  displayTitle: string

  @ApiProperty({ description: '徽标文案', example: '热门' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  badgeLabel: string

  @ApiProperty({
    description: '价格金额（字符串，最多两位小数）',
    example: '19.99',
  })
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: '价格金额格式不合法，最多支持两位小数',
  })
  priceAmount: string

  @ApiProperty({
    description: '价格币种（ISO 4217）',
    example: 'USD',
  })
  @Matches(/^[A-Z]{3}$/, { message: '价格币种必须是 3 位大写字母' })
  priceCurrency: string

  @ApiProperty({ description: '基础积分', example: 3000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseScore: number

  @ApiProperty({ description: '赠送百分比（0-100）', example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  bonusPercent: number

  @ApiProperty({ description: '总积分（基础+赠送）', example: 3300 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  totalScore: number

  @ApiProperty({ description: '排序值（越小越靠前）', example: 10, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder: number = 0

  @ApiPropertyOptional({
    description: '自定义元数据（JSON）',
    example: { highlightColor: '#ff9900' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
