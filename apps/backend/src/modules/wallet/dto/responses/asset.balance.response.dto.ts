import { ApiProperty } from '@nestjs/swagger'

export class AssetBalanceResponseDto {
  @ApiProperty({
    description: '资产类型ID',
    example: 'asset123',
  })
  assetTypeId: string

  @ApiProperty({
    description: '资产代码',
    example: 'SCORE',
  })
  code: string

  @ApiProperty({
    description: '可用余额',
    example: '1000.000000',
  })
  balance: string

  @ApiProperty({
    description: '冻结余额',
    example: '100.000000',
  })
  frozenBalance: string

  @ApiProperty({
    description: '总余额',
    example: '1100.000000',
  })
  totalBalance: string

  @ApiProperty({
    description: '资产优先级（越小越优先，由后端透出）',
    example: 1,
  })
  sortOrder: number
}
