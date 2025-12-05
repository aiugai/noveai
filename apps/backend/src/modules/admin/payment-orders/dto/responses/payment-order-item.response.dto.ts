import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentOrderSourceType, PaymentOrderStatus, Prisma } from '@prisma/client'

import type { CallbackStatus } from '@/modules/payment/services/payment-callback.service'

export type { CallbackStatus }

export interface PaymentOrderItemConstructorInput {
  id: string
  userId: string
  amount: Prisma.Decimal | number
  currency: string
  channel: string
  status: PaymentOrderStatus
  externalOrderId: string | null
  sourceType: PaymentOrderSourceType
  merchantId: string | null
  externalUserId: string | null
  businessOrderId: string | null
  description: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  paymentDetails?: Prisma.JsonValue | null
}

export class PaymentOrderItemResponseDto {
  @ApiProperty({ description: '订单ID' })
  id: string

  @ApiProperty({ description: '用户ID' })
  userId: string

  @ApiProperty({ description: '订单金额（保留两位小数）' })
  amount: string

  @ApiProperty({ description: '货币类型' })
  currency: string

  @ApiProperty({ description: '支付渠道' })
  channel: string

  @ApiProperty({ enum: PaymentOrderStatus, description: '订单状态' })
  status: PaymentOrderStatus

  @ApiProperty({ description: '第三方订单号', nullable: true })
  externalOrderId: string | null

  @ApiProperty({ enum: PaymentOrderSourceType, description: '订单来源类型' })
  sourceType: PaymentOrderSourceType

  @ApiProperty({ description: '商户ID', nullable: true })
  merchantId: string | null

  @ApiProperty({ description: '外部用户ID', nullable: true })
  externalUserId: string | null

  @ApiProperty({ description: '业务订单ID', nullable: true })
  businessOrderId: string | null

  @ApiProperty({ description: '订单描述', nullable: true })
  description: string | null

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date

  @ApiProperty({ description: '完成时间', nullable: true })
  completedAt: Date | null

  @ApiPropertyOptional({
    description: '回调状态（仅外部订单）',
    enum: ['PENDING', 'SUCCESS', 'FAILED'],
    nullable: true,
  })
  callbackStatus: CallbackStatus | null

  @ApiPropertyOptional({ description: '回调尝试次数（仅外部订单）', nullable: true })
  callbackAttempts: number | null

  constructor(partial: PaymentOrderItemConstructorInput) {
    this.id = partial.id
    this.userId = partial.userId
    this.currency = partial.currency
    this.channel = partial.channel
    this.status = partial.status
    this.externalOrderId = partial.externalOrderId
    this.sourceType = partial.sourceType
    this.merchantId = partial.merchantId
    this.externalUserId = partial.externalUserId
    this.businessOrderId = partial.businessOrderId
    this.description = partial.description
    this.createdAt = partial.createdAt
    this.updatedAt = partial.updatedAt
    this.completedAt = partial.completedAt
    this.amount = PaymentOrderItemResponseDto.serializeDecimal(partial.amount)

    // 从 paymentDetails.merchantContext 提取回调状态
    const merchantContext = this.extractMerchantContext(partial.paymentDetails)
    this.callbackStatus = merchantContext?.callbackStatus ?? null
    this.callbackAttempts = merchantContext?.callbackAttempts ?? null
  }

  private extractMerchantContext(
    paymentDetails: Prisma.JsonValue | null,
  ): { callbackStatus?: CallbackStatus; callbackAttempts?: number } | null {
    if (!paymentDetails || typeof paymentDetails !== 'object' || Array.isArray(paymentDetails)) {
      return null
    }
    const details = paymentDetails as Record<string, unknown>
    const merchantContext = details.merchantContext
    if (!merchantContext || typeof merchantContext !== 'object' || Array.isArray(merchantContext)) {
      return null
    }
    return merchantContext as { callbackStatus?: CallbackStatus; callbackAttempts?: number }
  }

  private static serializeDecimal(value: Prisma.Decimal | number): string {
    if (typeof value === 'object' && 'toString' in value) {
      return value.toString()
    }
    return String(value)
  }
}

