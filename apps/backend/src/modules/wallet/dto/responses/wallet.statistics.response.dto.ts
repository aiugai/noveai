import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { SystemWalletID } from '@prisma/client'

/**
 * 资产统计 DTO
 */
export class AssetStatisticsDto {
  @ApiProperty({ required: false, example: '1000.000000', description: '钻石金额' })
  DIAMOND?: string

  @ApiProperty({ required: false, example: '5000.000000', description: '积分金额' })
  SCORE?: string
}

export class SystemWalletBalanceBreakdownDto {
  @ApiProperty({ description: '钱包 ID', enum: SystemWalletID })
  walletId!: SystemWalletID

  @ApiProperty({ description: '余额（可用部分）', type: AssetStatisticsDto })
  balance!: AssetStatisticsDto

  @ApiPropertyOptional({ description: '冻结余额', type: AssetStatisticsDto })
  frozenBalance?: AssetStatisticsDto
}

export class SystemWalletCompatibilityGroupDto {
  @ApiProperty({ description: '统计分组名称' })
  label!: string

  @ApiProperty({ description: '主钱包', type: SystemWalletBalanceBreakdownDto })
  primary!: SystemWalletBalanceBreakdownDto

  @ApiProperty({ description: '历史钱包列表', type: () => [SystemWalletBalanceBreakdownDto] })
  legacy!: SystemWalletBalanceBreakdownDto[]

  @ApiProperty({ description: '合并余额', type: AssetStatisticsDto })
  combined!: AssetStatisticsDto

  @ApiPropertyOptional({ description: 'Legacy 占比（按资产）', type: Object })
  legacyShare?: Record<string, string>
}

export class SystemWalletCompatibilitySummaryDto {
  @ApiPropertyOptional({
    description: '系统 AI 收入兼容情况',
    type: SystemWalletCompatibilityGroupDto,
  })
  aiRevenue?: SystemWalletCompatibilityGroupDto

  @ApiPropertyOptional({ description: '系统营销兼容情况', type: SystemWalletCompatibilityGroupDto })
  marketing?: SystemWalletCompatibilityGroupDto
}

export class SystemWalletMigrationMonitorItemDto {
  @ApiProperty({ description: '统计分组 key', example: 'aiRevenue' })
  groupKey!: string

  @ApiProperty({ description: '主钱包 ID', enum: SystemWalletID })
  primaryWalletId!: SystemWalletID

  @ApiProperty({ description: 'Legacy 钱包 ID 列表', type: () => [String], enum: SystemWalletID })
  legacyWalletIds!: SystemWalletID[]

  @ApiProperty({ description: '关注资产', example: 'SCORE' })
  asset!: string

  @ApiProperty({ description: '合并余额', example: '123.456000' })
  combinedBalance!: string

  @ApiProperty({ description: 'Legacy 占比（0-1 字符串）', example: '0.25' })
  legacyShare!: string

  @ApiPropertyOptional({ description: '提示信息' })
  note?: string
}

/**
 * 钱包统计响应 DTO
 */
export class WalletStatisticsResponseDto {
  @ApiProperty({ description: '充值统计', type: AssetStatisticsDto })
  recharge: AssetStatisticsDto

  @ApiProperty({ description: '提现统计', type: AssetStatisticsDto })
  withdraw: AssetStatisticsDto

  @ApiProperty({ description: '分佣统计', type: AssetStatisticsDto })
  commission: AssetStatisticsDto

  @ApiProperty({ description: '消费统计', type: AssetStatisticsDto })
  consumption: AssetStatisticsDto

  @ApiPropertyOptional({
    description: '系统钱包兼容口径汇总',
    type: () => SystemWalletCompatibilitySummaryDto,
  })
  systemWalletRollup?: SystemWalletCompatibilitySummaryDto

  @ApiPropertyOptional({
    description: '系统钱包迁移监控提示',
    type: () => [SystemWalletMigrationMonitorItemDto],
  })
  migrationMonitor?: SystemWalletMigrationMonitorItemDto[]
}
