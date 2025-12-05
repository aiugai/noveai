import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

import { CallbackProductInfoDto } from './payment.order.response.dto'

/**
 * 外部订单状态响应 DTO
 *
 * @description
 * 用于 GET /payment/external/order-status 接口响应
 * productInfo 使用与回调通知相同的完整结构（CallbackProductInfoDto）
 * 便于商户在回调失败时重建 PaymentCenterCallbackDto
 */
export class ExternalOrderStatusResponseDto {
  @ApiProperty({
    description: '订单状态',
    enum: ['pending', 'success', 'failed'],
    example: 'success',
  })
  status: 'pending' | 'success' | 'failed'

  @ApiPropertyOptional({
    description: '商品信息（与回调通知中的 productInfo 结构一致）',
    type: CallbackProductInfoDto,
  })
  productInfo?: CallbackProductInfoDto

  @ApiPropertyOptional({
    description: '支付完成时间（ISO 8601）',
    example: '2025-12-02T10:30:00Z',
  })
  paidAt?: string

  constructor(data: {
    status: 'pending' | 'success' | 'failed'
    productInfo?: CallbackProductInfoDto
    paidAt?: Date | null
  }) {
    this.status = data.status
    this.productInfo = data.productInfo
    this.paidAt = data.paidAt?.toISOString()
  }
}
