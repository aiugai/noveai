import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { MessageEnvelope, MESSAGE_BUS_QUEUE } from '@/modules/message-bus/message-bus.types'
import { TOPIC_PAYMENT_EVENTS } from '@/modules/message-bus/message-bus.topics'
import { PAYMENT_EVENT } from '@/modules/message-bus/message-bus.event-types'
import { PaymentCallbackService } from '../services/payment-callback.service'
import { PrismaService } from '@/prisma/prisma.service'

@Processor(MESSAGE_BUS_QUEUE)
export class PaymentEventsSubscriber {
  private readonly logger = new Logger(PaymentEventsSubscriber.name)

  constructor(
    private readonly callbackService: PaymentCallbackService,
    private readonly prisma: PrismaService,
  ) {}

  @Process(TOPIC_PAYMENT_EVENTS)
  async handlePaymentEvents(job: Job<MessageEnvelope<any>>): Promise<void> {
    const payload = job.data
    const { type, data } = payload
    try {
      switch (type) {
        case PAYMENT_EVENT.DEPOSIT_COMPLETED: {
          const { userId, amount, orderId } = data as {
            userId: string
            amount: string
            orderId: string
          }
          this.logger.log(
            `Deposit completed event received: userId=${userId}, amount=${amount}, orderId=${orderId}`,
          )

          // 发送外部商户回调通知（如果是外部来源的订单）
          try {
            const order = await this.prisma.paymentOrder.findUnique({
              where: { id: orderId },
            })
            if (order && order.merchantId && order.callbackUrl) {
              this.logger.log(`触发外部商户回调: orderId=${orderId}, merchantId=${order.merchantId}`)
              await this.callbackService.sendPaymentSuccessCallback(order)
            }
          }
          catch (callbackErr) {
            // 回调失败不影响主流程，仅记录日志
            this.logger.error(
              `外部商户回调失败: orderId=${orderId}, error=${String(callbackErr)}`,
            )
          }
          break
        }
        default:
          this.logger.debug(`Unhandled payment event type: ${type}`)
          break
      }
    } catch (err) {
      this.logger.error(`Failed payment event type='${type}', jobId='${job.id}': ${String(err)}`)
      throw err
    }
  }
}
