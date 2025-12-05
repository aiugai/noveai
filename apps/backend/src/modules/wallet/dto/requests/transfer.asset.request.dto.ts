import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
  IsBoolean,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class TransferAssetRequestDto {
  @ApiProperty({
    description: '外部唯一ID，用于跨模块交互',
    example: 'payment_123456789',
    required: false,
  })
  @IsString()
  @IsOptional()
  uniqueId?: string;

  @ApiProperty({
    description: '转出钱包ID',
    example: 'wallet123',
  })
  @IsString()
  @IsNotEmpty()
  fromWalletId: string;

  @ApiProperty({
    description: '转入钱包ID',
    example: 'wallet456',
  })
  @IsString()
  @IsNotEmpty()
  toWalletId: string;

  @ApiProperty({
    description: '资产类型ID',
    example: 'asset123',
  })
  @IsString()
  @IsNotEmpty()
  assetTypeId: string;

  @ApiProperty({ description: '转移金额（字符串，>0）', example: '100.000000' })
  @IsString()
  @Matches(/^(?!0+(?:\.0+)?$)\d+(?:\.\d+)?$/, { message: 'amount 必须为大于0的数字字符串' })
  amount: string;

  @ApiProperty({
    description: '是否从冻结余额转出',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isFromFreeze?: boolean;

  @ApiProperty({
    description: '是否转入到冻结余额',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isToFreeze?: boolean;

  @ApiProperty({
    description: '交易类型',
    enum: TransactionType,
    example: TransactionType.TRANSFER,
  })
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({
    description: '交易原因',
    example: '用户转账',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiProperty({
    description: '交易元数据',
    example: { note: '测试转账' },
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
