import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentRechargePackage, RechargePackageStatus } from '@prisma/client'

export class RechargePackageResponseDto {
  @ApiProperty({ description: '套餐 ID' })
  id: string

  @ApiProperty({ description: '内部名称' })
  name: string

  @ApiProperty({ description: '展示标题' })
  displayTitle: string

  @ApiProperty({ description: '徽标文案' })
  badgeLabel: string

  @ApiProperty({ description: '价格金额（字符串）', example: '19.99' })
  priceAmount: string

  @ApiProperty({ description: '价格币种（ISO 4217）', example: 'USD' })
  priceCurrency: string

  @ApiProperty({ description: '基础积分' })
  baseScore: number

  @ApiProperty({ description: '赠送百分比（0-100）' })
  bonusPercent: number

  @ApiProperty({ description: '总积分（基础+赠送）' })
  totalScore: number

  @ApiProperty({ description: '排序值' })
  sortOrder: number

  @ApiProperty({
    description: '套餐状态',
    enum: RechargePackageStatus,
  })
  status: RechargePackageStatus

  @ApiPropertyOptional({ description: '自定义元数据' })
  metadata?: Record<string, unknown> | null

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  constructor(pkg: PaymentRechargePackage) {
    this.id = pkg.id
    this.name = pkg.name
    this.displayTitle = pkg.displayTitle
    this.badgeLabel = pkg.badgeLabel
    this.priceAmount = pkg.priceAmount.toFixed(2)
    this.priceCurrency = pkg.priceCurrency
    this.baseScore = pkg.baseScore
    this.bonusPercent = pkg.bonusPercent
    this.totalScore = pkg.totalScore
    this.sortOrder = pkg.sortOrder
    this.status = pkg.status
    this.metadata = (pkg.metadata as Record<string, unknown>) ?? null
    this.createdAt = pkg.createdAt
    this.updatedAt = pkg.updatedAt
  }
}
