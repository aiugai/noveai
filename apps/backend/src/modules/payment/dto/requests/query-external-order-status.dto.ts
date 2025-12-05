import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsString,
  IsNumber,
  IsNotEmpty,
  MaxLength,
} from 'class-validator'

/**
 * 查询外部订单状态请求 DTO
 *
 * @description
 * 外部商户查询订单状态
 * - 使用 HMAC-SHA256 签名验证商户身份
 * - 时间戳用于防重放攻击（± 5 分钟）
 */
export class QueryExternalOrderStatusDto {
  @ApiProperty({
    description: '商户标识',
    example: 'merchant_001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  merchantId!: string

  @ApiProperty({
    description: '商户业务订单ID',
    example: 'BIZ202512020001',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessOrderId!: string

  @ApiProperty({
    description: '请求时间戳（秒）',
    example: 1733097600,
  })
  @Type(() => Number)
  @IsNumber()
  timestamp!: number

  @ApiProperty({
    description: 'HMAC-SHA256 签名',
    example: 'abc123def456...',
  })
  @IsString()
  @IsNotEmpty()
  sign!: string
}
