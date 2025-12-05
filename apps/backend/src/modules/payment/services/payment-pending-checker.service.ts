import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '@/prisma/prisma.service'
import { PaymentOrderStatus } from '@prisma/client'
import { PaymentChannel } from '../enums/payment.channel.enum'
import { WGQPayProvider } from '../providers/wgqpay.payment.provider'
import { PaymentCallbackService } from './payment-callback.service'

/**
 * PENDING 订单检查服务
 *
 * @description
 * 定时查询 PENDING 状态的 WGQPAY 订单，主动向支付网关查询状态
 * 用于处理回调延迟或丢失的场景，确保订单状态最终一致
 */
@Injectable()
export class PaymentPendingCheckerService {
  private readonly logger = new Logger(PaymentPendingCheckerService.name)

  /** 每次最多处理的订单数 */
  private readonly BATCH_SIZE = 100

  /** 只查询创建超过此时间的订单（分钟） */
  private readonly MIN_AGE_MINUTES = 30

  constructor(
    private readonly prisma: PrismaService,
    private readonly wgqPayProvider: WGQPayProvider,
    private readonly callbackService: PaymentCallbackService,
  ) {}

  /**
   * 定时任务：每 10 分钟检查一次 PENDING 订单
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkPendingOrders(): Promise<void> {
    this.logger.log('开始检查 PENDING 订单...')

    try {
      const pendingOrders = await this.findPendingOrders()

      if (pendingOrders.length === 0) {
        this.logger.debug('没有需要检查的 PENDING 订单')
        return
      }

      this.logger.log(`找到 ${pendingOrders.length} 个待检查订单`)

      let successCount = 0
      let failedCount = 0
      let unchangedCount = 0

      for (const order of pendingOrders) {
        try {
          const result = await this.checkOrderStatus(order)
          if (result === 'success') successCount++
          else if (result === 'failed') failedCount++
          else unchangedCount++
        }
        catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          this.logger.error(`检查订单 ${order.id} 失败: ${errorMsg}`)
        }
      }

      this.logger.log(
        `PENDING 订单检查完成: success=${successCount}, failed=${failedCount}, unchanged=${unchangedCount}`,
      )
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      this.logger.error(`PENDING 订单检查任务异常: ${errorMsg}`)
    }
  }

  /**
   * 查找需要检查的 PENDING 订单
   */
  private async findPendingOrders() {
    const minAgeDate = new Date(Date.now() - this.MIN_AGE_MINUTES * 60 * 1000)

    return this.prisma.paymentOrder.findMany({
      where: {
        status: PaymentOrderStatus.PENDING,
        channel: PaymentChannel.WGQPAY,
        createdAt: {
          lt: minAgeDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: this.BATCH_SIZE,
    })
  }

  /**
   * 检查单个订单状态
   *
   * @param order - 已查询的订单对象（避免 N+1 查询）
   * @returns 'success' | 'failed' | 'unchanged'
   */
  private async checkOrderStatus(order: Awaited<ReturnType<typeof this.findPendingOrders>>[number]): Promise<'success' | 'failed' | 'unchanged'> {
    this.logger.debug(`检查订单状态: orderId=${order.id}`)

    // 如果订单已不是 PENDING 状态，跳过（可能在查询后被其他进程更新）
    if (order.status !== PaymentOrderStatus.PENDING) {
      this.logger.debug(`订单状态已更新，跳过: orderId=${order.id}, status=${order.status}`)
      return 'unchanged'
    }

    // TODO: WGQPAY 目前没有主动查询接口，此处预留扩展
    // 后续迭代可实现 WGQPayProvider.queryOrder() 主动查询支付状态
    this.logger.debug(`订单 ${order.id} 仍为 PENDING 状态，等待支付网关回调`)

    // 如果订单有外部商户配置且超过一定时间，可以考虑标记为超时
    const orderAgeMinutes = (Date.now() - order.createdAt.getTime()) / 60000
    if (orderAgeMinutes > 60) {
      // 超过 1 小时的 PENDING 订单，记录警告
      this.logger.warn(`订单 ${order.id} 已 PENDING 超过 ${Math.round(orderAgeMinutes)} 分钟`)
    }

    return 'unchanged'
  }

}
