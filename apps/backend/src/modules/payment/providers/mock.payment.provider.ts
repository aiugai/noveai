import { Injectable, Logger } from '@nestjs/common'
import { IPaymentProvider, IPaymentResult } from '../interfaces/payment.provider.interface'
import { PaymentOrder, PaymentOrderStatus } from '@prisma/client'
import { generateShortId } from '@ai/shared'
import { PaymentChannel } from '../enums/payment.channel.enum'

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name)
  readonly channel = PaymentChannel.MOCK

  private pendingPayments: Map<string, PaymentOrder> = new Map()

  constructor() {
    this.logger.log('MockPaymentProvider initialized')
  }

  async createPayment(order: PaymentOrder): Promise<IPaymentResult> {
    this.logger.log(
      `[${this.channel}] Creating payment for order: ${order.id}, Amount: ${order.amount} ${order.currency}`,
    )
    const externalOrderId = `mock_pi_${generateShortId()}`

    const random = Math.random()

    if (random < 0.1) {
      this.logger.warn(
        `[${this.channel}] Simulating immediate payment failure for order ${order.id}`,
      )
      return { status: 'FAILED', externalOrderId, error: 'Mock failure: Insufficient funds' }
    } else if (random < 0.2) {
      this.logger.log(
        `[${this.channel}] Simulating immediate payment completion for order ${order.id}`,
      )
      return { status: 'COMPLETED', externalOrderId }
    } else {
      this.logger.log(`[${this.channel}] Simulating pending payment for order ${order.id}`)
      this.pendingPayments.set(externalOrderId, order)
      return {
        status: 'PENDING',
        externalOrderId,
        paymentDetails: {
          mockPaymentUrl: `https://mock-payment-gateway.test/pay/${externalOrderId}`,
          message: 'Please visit the mock payment URL to complete payment.',
        },
      }
    }
  }

  async handleCallback(payload: Record<string, unknown>): Promise<Partial<PaymentOrder> | null> {
    this.logger.log(`[${this.channel}] Handling callback with payload:`, payload)

    const { orderId, externalOrderId, success, amount, currency } = payload as {
      orderId?: string
      externalOrderId?: string
      success?: boolean
      amount?: string
      currency?: string
    }

    if (!externalOrderId || typeof success !== 'boolean') {
      this.logger.error(`[${this.channel}] Invalid callback payload structure.`)
      return null
    }

    // 尝试从内存中获取订单（正常 mock 流程）
    const order = this.pendingPayments.get(externalOrderId)
    if (order) {
      this.pendingPayments.delete(externalOrderId)
    }

    // 无论是否在内存中找到，都返回状态更新
    // 这支持 Admin 端对已存在订单的模拟回调场景
    const newStatus = success ? PaymentOrderStatus.COMPLETED : PaymentOrderStatus.FAILED
    this.logger.log(
      `[${this.channel}] Processing callback for orderId=${orderId} externalOrderId=${externalOrderId}. New status: ${newStatus}`,
    )

    return {
      // 优先使用显式传递的 orderId（Admin 模拟场景），其次使用内存中的订单 ID
      id: orderId ?? order?.id,
      externalOrderId,
      status: newStatus,
      completedAt: new Date(),
      // 透传金额和币种信息，供 PaymentService 校验
      ...(amount !== undefined && { amount: amount as unknown as PaymentOrder['amount'] }),
      ...(currency !== undefined && { currency }),
    }
  }
}
