import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator'

export class AdminDepositRequestDto {
  @ApiProperty({ description: '用户ID', example: 'user123' })
  @IsString()
  @IsNotEmpty()
  userId: string

  @ApiProperty({ description: '资产类型ID', example: 'DIAMOND' })
  @IsString()
  @IsNotEmpty()
  assetTypeId: string

  @ApiProperty({ description: '金额（字符串，>0，最多6位小数）', example: '100.000000' })
  @IsString()
  @Matches(/^(?!0+(?:\.0+)?$)\d+(?:\.\d+)?$/, { message: 'amount 必须为大于0的数字字符串' })
  amount: string

  @ApiPropertyOptional({ description: '原因', example: '管理员充值' })
  @IsString()
  @IsOptional()
  reason?: string

  @ApiPropertyOptional({ description: '元数据', type: 'object', additionalProperties: true })
  @IsOptional()
  metadata?: Record<string, any>

  @ApiProperty({ description: '交易唯一ID', required: true, example: 'txn123' })
  @IsString()
  @IsNotEmpty()
  uniqueId: string
}
