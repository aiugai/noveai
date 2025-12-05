import { ApiProperty } from '@nestjs/swagger'

export class RechargePackageOptionDto {
  @ApiProperty({ description: '套餐 ID' })
  id!: string

  @ApiProperty({ description: '展示标题' })
  displayTitle!: string

  @ApiProperty({ description: '徽标文案' })
  badgeLabel!: string

  @ApiProperty({ description: '价格金额（字符串，保留两位小数）' })
  priceAmount!: string

  @ApiProperty({ description: '价格币种（ISO 4217）' })
  priceCurrency!: string

  @ApiProperty({ description: '基础积分' })
  baseScore!: number

  @ApiProperty({ description: '赠送百分比' })
  bonusPercent!: number

  @ApiProperty({ description: '赠送积分' })
  bonusScore!: number

  @ApiProperty({ description: '总积分' })
  totalScore!: number

  @ApiProperty({ description: '排序值（升序显示）' })
  sortOrder!: number
}

