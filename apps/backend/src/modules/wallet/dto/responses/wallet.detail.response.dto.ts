import { ApiProperty } from '@nestjs/swagger';
import { AssetBalanceResponseDto } from './asset.balance.response.dto';

export class WalletDetailResponseDto {
  @ApiProperty({
    description: '钱包ID',
    example: 'wallet123',
  })
  id: string;

  @ApiProperty({
    description: '用户ID',
    example: 'user123',
    type: String,
    nullable: true,
  })
  userId: string | null;

  @ApiProperty({
    description: '资产余额列表',
    type: [AssetBalanceResponseDto],
  })
  assets: AssetBalanceResponseDto[];

  @ApiProperty({
    description: '创建时间',
  })
  createdAt: Date;

  @ApiProperty({
    description: '更新时间',
  })
  updatedAt: Date;
}
