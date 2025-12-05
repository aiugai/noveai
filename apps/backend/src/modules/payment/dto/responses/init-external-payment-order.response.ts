import { ApiProperty } from '@nestjs/swagger'

/**
 * 初始化外部支付订单响应 DTO
 *
 * @description
 * 返回支付页面 URL 和订单 ID
 */
export class InitExternalPaymentOrderResponse {
  @ApiProperty({
    description: '支付订单ID',
    example: 'clx1234567890',
  })
  paymentOrderId!: string

  @ApiProperty({
    description: '支付页面 URL(带访问令牌)',
    example: 'https://payment.example.com/pay/clx1234567890?token=xxx',
  })
  paymentUrl!: string

  @ApiProperty({
    description: '令牌过期时间(毫秒时间戳)',
    example: 1704096000000,
  })
  expiresAt!: number
}
