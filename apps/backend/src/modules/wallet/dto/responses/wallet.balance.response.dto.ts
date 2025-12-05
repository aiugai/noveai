import { ApiProperty } from '@nestjs/swagger';

export class WalletBalanceResponseDto {
  @ApiProperty({
    description: '钱包ID',
    example: 'wallet123',
  })
  walletId: string;

  @ApiProperty({
    description: '资产类型ID',
    example: 'asset123',
  })
  assetTypeId: string;

  @ApiProperty({
    description: '资产代码',
    example: 'SCORE',
  })
  code: string;

  @ApiProperty({
    description: '可用余额',
    example: '1000.000000',
  })
  balance: string;

  @ApiProperty({
    description: '冻结余额',
    example: '100.000000',
  })
  frozenBalance: string;

  @ApiProperty({
    description: '总余额',
    example: '1100.000000',
  })
  totalBalance: string;
}
