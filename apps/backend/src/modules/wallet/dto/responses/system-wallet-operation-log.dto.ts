import { ApiProperty } from '@nestjs/swagger'
import { SystemWalletID } from '@prisma/client'
import { BasePaginationResponseDto } from '@/common/dto/base.dto'

export class SystemWalletOperationLogDto {
  @ApiProperty({ description: '交易记录 ID' })
  id: string

  @ApiProperty({ description: '钱包 ID', enum: SystemWalletID })
  walletId: SystemWalletID

  @ApiProperty({ description: '钱包名称' })
  walletName: string

  @ApiProperty({ description: '资产类型代码' })
  assetCode: string

  @ApiProperty({ enum: ['INCREASE', 'DECREASE'], description: '操作方向' })
  direction: 'INCREASE' | 'DECREASE'

  @ApiProperty({ enum: ['manual', 'auto'], description: '调整类型' })
  adjustmentType: 'manual' | 'auto'

  @ApiProperty({ description: '调整金额' })
  amount: string

  @ApiProperty({ description: '操作前余额' })
  balanceBefore: string

  @ApiProperty({ description: '操作后余额' })
  balanceAfter: string

  @ApiProperty({ description: '调整原因' })
  reason: string

  @ApiProperty({ description: '操作员 ID' })
  operatorId: string

  @ApiProperty({ description: '操作员昵称' })
  operatorNickname: string

  @ApiProperty({ description: '创建时间' })
  createdAt: Date
}

export class PaginatedSystemWalletOperationLogDto extends BasePaginationResponseDto<SystemWalletOperationLogDto> {
  @ApiProperty({ type: [SystemWalletOperationLogDto] })
  items: SystemWalletOperationLogDto[]
}
