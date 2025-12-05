import { ApiProperty } from '@nestjs/swagger'

export class SystemWalletMetadataDto {
  @ApiProperty({
    description: '系统钱包ID',
    example: 'SYSTEM_AI_REVENUE',
  })
  id: string

  @ApiProperty({
    description: '系统钱包名称',
    example: 'AI 收入钱包',
  })
  name: string
}

export class AssetTypeMetadataDto {
  @ApiProperty({
    description: '资产代码',
    example: 'DIAMOND',
  })
  code: string

  @ApiProperty({
    description: '资产名称',
    example: '钻石',
  })
  name: string
}

export class WalletMetadataResponseDto {
  @ApiProperty({
    description: '系统钱包列表',
    type: [SystemWalletMetadataDto],
  })
  systemWallets: SystemWalletMetadataDto[]

  @ApiProperty({
    description: '资产类型列表',
    type: [AssetTypeMetadataDto],
  })
  assetTypes: AssetTypeMetadataDto[]
}
