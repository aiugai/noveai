import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { CallbackStatus } from '../../services/payment-callback.service'

/**
 * 回调信息输入参数（由 Service 构建）
 */
export interface CallbackInfoInput {
  orderId: string
  merchantId: string
  businessOrderId: string
  callbackUrl: string
  returnUrl?: string
  callbackStatus: CallbackStatus
  callbackAttempts: number
  lastCallbackAt?: string
  lastCallbackError?: string
  canRetry: boolean
}

/**
 * 回调信息响应 DTO
 *
 * @description
 * 纯数据载体，复杂逻辑由 Service 层处理
 */
export class CallbackInfoResponseDto {
  @ApiProperty({ description: '支付订单 ID' })
  orderId: string

  @ApiProperty({ description: '商户 ID' })
  merchantId: string

  @ApiProperty({ description: '业务订单号' })
  businessOrderId: string

  @ApiProperty({ description: '回调地址' })
  callbackUrl: string

  @ApiPropertyOptional({ description: '返回地址' })
  returnUrl?: string

  @ApiProperty({ description: '回调状态', enum: ['PENDING', 'SUCCESS', 'FAILED'] })
  callbackStatus: CallbackStatus

  @ApiProperty({ description: '回调尝试次数' })
  callbackAttempts: number

  @ApiPropertyOptional({ description: '最后回调时间 (ISO 8601)' })
  lastCallbackAt?: string

  @ApiPropertyOptional({ description: '最后回调错误信息' })
  lastCallbackError?: string

  @ApiProperty({ description: '是否可以重试' })
  canRetry: boolean

  constructor(input: CallbackInfoInput) {
    this.orderId = input.orderId
    this.merchantId = input.merchantId
    this.businessOrderId = input.businessOrderId
    this.callbackUrl = input.callbackUrl
    this.returnUrl = input.returnUrl
    this.callbackStatus = input.callbackStatus
    this.callbackAttempts = input.callbackAttempts
    this.lastCallbackAt = input.lastCallbackAt
    this.lastCallbackError = input.lastCallbackError
    this.canRetry = input.canRetry
  }
}
