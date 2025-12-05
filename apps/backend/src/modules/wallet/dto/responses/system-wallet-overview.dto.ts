import { ApiProperty } from '@nestjs/swagger'
import { SystemWalletID } from '@prisma/client'

export class SystemWalletItemDto {
  @ApiProperty({ description: '钱包 ID', enum: SystemWalletID })
  walletId: SystemWalletID

  @ApiProperty({ description: '钱包中文名称' })
  walletName: string

  @ApiProperty({
    description: '钱包显示名称(格式: 佣金支出钱包(SYSTEM_COMMISSION))',
    example: '佣金支出钱包(SYSTEM_COMMISSION)',
  })
  displayName: string

  @ApiProperty({ description: '钱包枚举值', example: 'SYSTEM_COMMISSION' })
  walletCode: string

  @ApiProperty({ description: '是否允许手动调整余额', example: false })
  isAdjustable: boolean

  @ApiProperty({ description: '资产类型代码' })
  assetCode: string

  @ApiProperty({ description: '资产类型名称' })
  assetName: string

  @ApiProperty({ description: '可用余额' })
  balance: string

  @ApiProperty({ description: '冻结余额' })
  frozenBalance: string

  @ApiProperty({ description: '总余额（可用 + 冻结）' })
  totalBalance: string

  @ApiProperty({ description: '最后更新时间' })
  updatedAt: Date

  @ApiProperty({ description: '是否为废弃钱包' })
  isLegacy: boolean

  @ApiProperty({ required: false, description: '迁移目标钱包（仅废弃钱包）', enum: SystemWalletID })
  migrationTarget?: SystemWalletID
}

export class SystemWalletGroupDto {
  @ApiProperty({ description: '分组名称' })
  groupName: string

  @ApiProperty({ type: [SystemWalletItemDto], description: '分组内的钱包列表' })
  wallets: SystemWalletItemDto[]
}

export class SystemWalletOverviewDto {
  @ApiProperty({ type: SystemWalletGroupDto, description: '收入类钱包' })
  revenue: SystemWalletGroupDto

  @ApiProperty({ type: SystemWalletGroupDto, description: '支出类钱包' })
  expense: SystemWalletGroupDto

  @ApiProperty({ type: SystemWalletGroupDto, description: '中转类钱包' })
  transit: SystemWalletGroupDto

  @ApiProperty({ type: SystemWalletGroupDto, description: '特殊类钱包' })
  special: SystemWalletGroupDto

  @ApiProperty({ type: [SystemWalletItemDto], description: '废弃钱包（平铺展示）' })
  legacy: SystemWalletItemDto[]
}
