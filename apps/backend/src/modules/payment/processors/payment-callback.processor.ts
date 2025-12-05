import { Processor, Process } from '@nestjs/bull'
import { Job } from 'bull'
import { Logger } from '@nestjs/common'
import { PrismaService } from '@/prisma/prisma.service'
import { PaymentCallbackService } from '../services/payment-callback.service'
import {
  PAYMENT_CALLBACK_QUEUE,
  type CallbackRetryJobData,
} from '../constants/callback.constants'

@Processor(PAYMENT_CALLBACK_QUEUE)
export class PaymentCallbackProcessor {
  private readonly logger = new Logger(PaymentCallbackProcessor.name)

  constructor(
    private readonly callbackService: PaymentCallbackService,
    private readonly prisma: PrismaService,
  ) {}

  @Process()
  async handleCallbackRetry(job: Job<CallbackRetryJobData>): Promise<void> {
    const { orderId, attempt } = job.data

    this.logger.log(`处理回调重试任务: orderId=${orderId}, attempt=${attempt}`)

    try {
      // 获取最新订单数据
      const order = await this.prisma.paymentOrder.findUnique({
        where: { id: orderId },
      })

      if (!order) {
        this.logger.warn(`订单不存在，跳过重试: orderId=${orderId}`)
        return
      }

      // 使用 service 的公共方法检查回调状态
      if (this.callbackService.isCallbackCompleted(order)) {
        this.logger.debug(`订单回调已完成或无需回调，跳过重试: orderId=${orderId}`)
        return
      }

      // 执行回调
      const success = await this.callbackService.sendPaymentSuccessCallback(order)

      if (success) {
        this.logger.log(`回调重试成功: orderId=${orderId}, attempt=${attempt}`)
      }
      else {
        this.logger.warn(`回调重试失败: orderId=${orderId}, attempt=${attempt}`)
        // 失败时 Bull 会根据配置自动重试或标记为失败
        throw new Error(`Callback retry failed for order ${orderId}`)
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`回调重试异常: orderId=${orderId}, attempt=${attempt}, error=${errorMessage}`)
      throw error // 让 Bull 处理重试逻辑
    }
  }
}
