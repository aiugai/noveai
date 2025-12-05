import { ApiProperty } from '@nestjs/swagger'

export class SnapshotDataPointDto {
  @ApiProperty({
    description: '日期（YYYY-MM-DD）',
    example: '2025-01-15',
  })
  date: string

  @ApiProperty({
    description: '总余额（可用 + 冻结）',
    example: '1000.50',
  })
  totalBalance: string

  @ApiProperty({
    description: '可用余额',
    example: '850.50',
  })
  availableBalance: string

  @ApiProperty({
    description: '冻结余额',
    example: '150.00',
  })
  frozenBalance: string

  @ApiProperty({
    description: '余额变化量（相对前一天，正值表示增加，负值表示减少）',
    example: '50.00',
  })
  balanceChange: string
}

export class SnapshotTrendDto {
  @ApiProperty({
    description: '资产代码',
    example: 'DIAMOND',
  })
  assetCode: string

  @ApiProperty({
    description: '资产名称',
    example: '钻石',
  })
  assetName: string

  @ApiProperty({
    description: '数据点列表',
    type: [SnapshotDataPointDto],
  })
  dataPoints: SnapshotDataPointDto[]
}

export class SnapshotHistoryResponseDto {
  @ApiProperty({
    description: '趋势数据列表',
    type: [SnapshotTrendDto],
  })
  trends: SnapshotTrendDto[]
}
