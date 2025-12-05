import { ApiProperty } from '@nestjs/swagger'
import {
  IsString,
  IsNumber,
  IsUrl,
  IsNotEmpty,
  Min,
  MaxLength,
} from 'class-validator'

/**
 * 初始化外部支付订单请求 DTO
 *
 * @description
 * 用于商户创建支付订单并获取支付页面 URL
 * 需要提供签名验证
 */
export class InitExternalPaymentOrderDto {
  @ApiProperty({
    description: '商户标识',
    example: 'wallet_recharge',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  merchantId!: string

  @ApiProperty({
    description: '商户业务订单ID',
    example: 'ORDER_20250101_123456',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  businessOrderId!: string

  @ApiProperty({
    description: '商户的外部用户ID',
    example: 'EXT_USER_789',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  externalUserId!: string

  @ApiProperty({
    description: '支付金额(美元)',
    example: 10.0,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  amount!: number

  @ApiProperty({
    description: '订单描述',
    example: '充值 100 积分',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  description!: string

  @ApiProperty({
    description: '商户回调 URL',
    example: 'https://merchant.com/payment/callback',
  })
  @IsUrl()
  @IsNotEmpty()
  @MaxLength(500)
  callbackUrl!: string

  @ApiProperty({
    description: '用户支付完成返回 URL',
    example: 'https://merchant.com/payment/return',
  })
  @IsUrl()
  @IsNotEmpty()
  @MaxLength(500)
  returnUrl!: string

  @ApiProperty({
    description: '请求时间戳(毫秒)',
    example: 1704096000000,
  })
  @IsNumber()
  timestamp!: number

  @ApiProperty({
    description: '随机字符串',
    example: 'abc123def456',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nonce!: string

  @ApiProperty({
    description: 'HMAC-SHA256 签名',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  sign!: string
}
