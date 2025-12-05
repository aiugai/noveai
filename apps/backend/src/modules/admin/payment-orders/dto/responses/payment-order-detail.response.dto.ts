import { ApiProperty } from '@nestjs/swagger'
import { Prisma } from '@prisma/client'

import {
  PaymentOrderItemConstructorInput,
  PaymentOrderItemResponseDto,
} from './payment-order-item.response.dto'

export interface PaymentOrderDetailConstructorInput extends PaymentOrderItemConstructorInput {
  targetAssetTypeId: string | null
  targetAssetAmount: Prisma.Decimal | number | null
  exchangeRate: Prisma.Decimal | number | null
  paymentDetails: Prisma.JsonValue | null
  callbackData: Prisma.JsonValue | null
  expiresAt: Date | null
}

export class PaymentOrderDetailResponseDto extends PaymentOrderItemResponseDto {
  @ApiProperty({ description: '目标资产类型ID', nullable: true })
  targetAssetTypeId: string | null

  @ApiProperty({ description: '目标资产数量', nullable: true })
  targetAssetAmount: string | null

  @ApiProperty({ description: '汇率', nullable: true })
  exchangeRate: string | null

  @ApiProperty({
    description: '支付详情',
    nullable: true,
    example: { qrCode: 'https://example.com/qr' },
  })
  paymentDetails: Record<string, unknown> | null

  @ApiProperty({
    description: '回调数据',
    nullable: true,
    example: { state: 'completed' },
  })
  callbackData: Record<string, unknown> | null

  @ApiProperty({ description: '订单过期时间', nullable: true })
  expiresAt: Date | null

  constructor(partial: PaymentOrderDetailConstructorInput) {
    super(partial)
    this.targetAssetTypeId = partial.targetAssetTypeId
    this.expiresAt = partial.expiresAt
    this.paymentDetails = this.normalizeJsonRecord(partial.paymentDetails)
    this.callbackData = this.normalizeJsonRecord(partial.callbackData)
    this.targetAssetAmount = this.serializeDecimalOrNull(partial.targetAssetAmount)
    this.exchangeRate = this.serializeDecimalOrNull(partial.exchangeRate)
  }

  private serializeDecimalOrNull(value: Prisma.Decimal | number | null): string | null {
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value === 'object' && 'toString' in value) {
      return value.toString()
    }
    return String(value)
  }

  private normalizeJsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (value === null) return null
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
    return null
  }
}

