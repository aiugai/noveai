import { ApiProperty } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '@prisma/client';

export class TransactionResponseDto {
  @ApiProperty({
    description: '交易ID',
    example: 'transaction123',
  })
  id: string;

  @ApiProperty({
    description: '外部唯一ID',
    example: 'payment_123456789',
    required: false,
  })
  uniqueId?: string;

  @ApiProperty({
    description: '转出钱包ID',
    example: 'wallet123',
  })
  fromWalletId: string;

  @ApiProperty({
    description: '转入钱包ID',
    example: 'wallet456',
  })
  toWalletId: string;

  @ApiProperty({
    description: '资产类型ID',
    example: 'asset123',
  })
  assetTypeId: string;

  @ApiProperty({
    description: '交易金额',
    example: '100.000000',
  })
  amount: string;

  @ApiProperty({
    description: '交易类型',
    enum: TransactionType,
    example: TransactionType.TRANSFER,
  })
  type: TransactionType;

  @ApiProperty({
    description: '交易状态',
    enum: TransactionStatus,
    example: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;

  @ApiProperty({
    description: '交易原因',
    example: '用户转账',
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: '交易元数据',
    example: { note: '测试转账' },
    required: false,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: '创建时间',
    example: '2023-01-01T00:00:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: '更新时间',
    example: '2023-01-01T00:00:00Z',
  })
  updatedAt: Date;
}
