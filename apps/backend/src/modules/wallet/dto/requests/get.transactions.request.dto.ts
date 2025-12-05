import { ApiProperty } from '@nestjs/swagger'
import { IsOptional, IsString, IsEnum } from 'class-validator'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'
import { TransactionType } from '@prisma/client'

export class GetTransactionsRequestDto extends BasePaginationRequestDto {
  @ApiProperty({
    description: '转出钱包ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  fromWalletId?: string

  @ApiProperty({
    description: '转入钱包ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  toWalletId?: string

  @ApiProperty({
    description: '资产类型ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  assetTypeId?: string

  @ApiProperty({
    description: '交易类型',
    enum: TransactionType,
    enumName: 'TransactionType',
    required: false,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType
}
