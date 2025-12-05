import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { HttpClientService } from '@/common/http/http-client.service'
import { PrismaService } from '@/prisma/prisma.service'
import { SignatureUtil } from '../utils/signature.util'
import { PaymentMerchantService } from './payment-merchant.service'
import {
  PAYMENT_CALLBACK_QUEUE,
  RETRY_DELAYS,
  MAX_RETRY_ATTEMPTS,
  type CallbackRetryJobData,
} from '../constants/callback.constants'
import type { PaymentOrder, Prisma } from '@prisma/client'

interface CallbackResponse {
  success?: boolean
}

/**
 * 回调通知状态
 */
export type CallbackStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

/**
 * 商户上下文（存储在 paymentDetails.merchantContext）
 */
interface MerchantContext {
  merchantId: string
  businessOrderId: string
  externalUserId?: string
  /** 商户期望的支付金额（美元） */
  amount?: number
  callbackUrl: string
  returnUrl?: string
  callbackStatus: CallbackStatus
  callbackAttempts: number
  lastCallbackAt?: string
  lastCallbackError?: string
}

/**
 * 套餐信息（回调中的商品详情）
 */
interface CallbackProductInfo {
  /** 套餐 ID */
  id: string
  /** 套餐名称（内部标识） */
  name: string
  /** 展示标题 */
  displayTitle: string
  /** 徽章标签（如"热门"） */
  badgeLabel?: string
  /** 套餐价格（美元） */
  priceAmount: string
  /** 套餐币种 */
  priceCurrency: string
  /** 基础积分 */
  baseScore: number
  /** 赠送积分 */
  bonusScore: number
  /** 总积分 */
  totalScore: number
}

/**
 * 回调请求体
 */
interface CallbackPayload {
  paymentOrderId: string
  businessOrderId: string
  merchantId: string
  /** 商户期望金额（签名时的金额） */
  amount: string
  /** 商户期望币种（固定 USD） */
  currency: string
  /** 实际结算金额 */
  settledAmount: string
  /** 实际结算币种 */
  settledCurrency: string
  status: string
  paidAt: string
  /** 套餐信息（用户选购的商品详情） */
  productInfo?: CallbackProductInfo
  timestamp: number
  sign: string
}

/**
 * 支付回调通知服务
 *
 * @description
 * 负责在支付成功后通知外部商户
 * - 发送 HTTP POST 回调
 * - 使用 HMAC-SHA256 签名
 * - 记录回调状态
 */
@Injectable()
export class PaymentCallbackService {
  private readonly logger = new Logger(PaymentCallbackService.name)

  constructor(
    private readonly httpClient: HttpClientService,
    private readonly prisma: PrismaService,
    private readonly signatureUtil: SignatureUtil,
    private readonly merchantService: PaymentMerchantService,
    @InjectQueue(PAYMENT_CALLBACK_QUEUE)
    private readonly callbackQueue: Queue<CallbackRetryJobData>,
  ) {}

  /**
   * 发送支付成功回调通知
   *
   * @param order - 已完成的支付订单
   * @returns 回调是否成功
   */
  async sendPaymentSuccessCallback(order: PaymentOrder): Promise<boolean> {
    // 检查是否为外部订单
    if (!order.merchantId || !order.callbackUrl) {
      this.logger.debug(`订单 ${order.id} 不是外部订单，跳过回调`)
      return true
    }

    const merchantContext = this.getMerchantContext(order)
    if (!merchantContext) {
      this.logger.warn(`订单 ${order.id} 缺少商户上下文，跳过回调`)
      return true
    }

    // 检查是否已经回调成功
    if (merchantContext.callbackStatus === 'SUCCESS') {
      this.logger.debug(`订单 ${order.id} 回调已成功，跳过重复回调`)
      return true
    }

    try {
      // 获取商户密钥
      const secretKey = await this.merchantService.getMerchantSecretKey(order.merchantId)

      // 构建回调请求体
      // 使用商户期望金额（USD），而非结算金额（可能是 CNY）
      const timestamp = Date.now()
      // merchantContext.amount 应为 USD 金额字符串；若缺失则从 paymentDetails.requested 回退
      const details = order.paymentDetails as Record<string, unknown> | null
      const requestedAmount = (details?.requested as { amount?: string } | undefined)?.amount
      const merchantAmount = String(merchantContext.amount || requestedAmount || order.amount)
      const merchantCurrency = 'USD' // 商户签名时的币种固定为 USD

      // 从订单中提取套餐信息
      const productInfo = this.extractProductInfo(order)

      const payload: Omit<CallbackPayload, 'sign'> = {
        paymentOrderId: order.id,
        businessOrderId: order.businessOrderId!,
        merchantId: order.merchantId,
        amount: merchantAmount,
        currency: merchantCurrency,
        // 附加结算金额信息，供商户对账
        settledAmount: order.amount.toString(),
        settledCurrency: order.currency,
        status: order.status,
        paidAt: order.completedAt?.toISOString() || new Date().toISOString(),
        // 套餐信息（用户选购的商品详情）
        ...(productInfo && { productInfo }),
        timestamp,
      }

      // 生成签名（productInfo 参与签名，使用扁平化字段）
      const signPayload = this.buildSignPayload(payload, productInfo)
      const sign = this.signatureUtil.sign(signPayload, secretKey)
      const callbackPayload: CallbackPayload = { ...payload, sign }

      // 日志脱敏：仅记录域名，避免泄露完整 URL 路径或 token
      const callbackHost = this.getUrlHost(order.callbackUrl)
      // 使用 ?? 0 确保 undefined 时不会变成 NaN
      const currentAttemptCount = (merchantContext.callbackAttempts ?? 0) + 1
      this.logger.log(
        `发送回调通知: orderId=${order.id}, callbackHost=${callbackHost}, attempt=${currentAttemptCount}`,
      )

      // 发送 HTTP POST 请求
      await this.httpClient.postJson<CallbackResponse>(
        order.callbackUrl,
        callbackPayload,
        {
          timeoutMs: 30000,
        },
      )

      // postJson 成功返回则表示请求成功（2xx 状态码）
      await this.updateCallbackStatus(order.id, merchantContext, 'SUCCESS')
      this.logger.log(`回调成功: orderId=${order.id}`)

      return true
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`回调异常: orderId=${order.id}, error=${errorMessage}`)

      // 更新回调状态
      // 使用 ?? 0 确保 undefined 时不会变成 NaN
      const currentAttempts = (merchantContext.callbackAttempts ?? 0) + 1
      await this.updateCallbackStatus(order.id, merchantContext, 'FAILED', errorMessage)

      // 如果未超过最大重试次数，加入重试队列
      // currentAttempts 是"已完成的尝试次数"（包含本次失败）
      // RETRY_DELAYS 有 3 档 (1/5/15 分钟)，MAX_RETRY_ATTEMPTS = 3
      // 需要调度第 1/2/3 次重试，因此用 <= 而非 <
      if (currentAttempts <= MAX_RETRY_ATTEMPTS) {
        await this.scheduleRetry(order.id, currentAttempts)
      }
      else {
        this.logger.warn(`回调已达最大重试次数，放弃重试: orderId=${order.id}, attempts=${currentAttempts}`)
      }

      return false
    }
  }

  /**
   * 调度回调重试任务
   */
  async scheduleRetry(orderId: string, attempt: number): Promise<void> {
    // attempt 是"已完成的尝试次数"，用于确定下一次重试的延迟
    // 当 attempt > MAX_RETRY_ATTEMPTS 时才停止调度
    if (attempt > MAX_RETRY_ATTEMPTS) {
      this.logger.warn(`已达最大重试次数，不再调度: orderId=${orderId}, attempt=${attempt}`)
      return
    }

    // attempt 是 1-based（第1次重试 attempt=1），RETRY_DELAYS 是 0-based
    const delayIndex = attempt - 1
    const delay = RETRY_DELAYS[delayIndex] ?? RETRY_DELAYS[RETRY_DELAYS.length - 1]
    const delayMinutes = Math.round(delay / 60000)

    this.logger.log(`调度回调重试: orderId=${orderId}, attempt=${attempt + 1}, delay=${delayMinutes}分钟`)

    await this.callbackQueue.add(
      { orderId, attempt: attempt + 1 },
      {
        delay,
        attempts: 1, // 队列任务本身不重试，由服务层控制重试逻辑
        removeOnComplete: true,
        removeOnFail: false,
        jobId: `callback-retry-${orderId}-${attempt + 1}`, // 防止重复任务
      },
    )
  }

  /**
   * 获取商户上下文
   */
  getMerchantContext(order: PaymentOrder): MerchantContext | null {
    const details = order.paymentDetails as Record<string, unknown> | null
    if (!details) return null

    const ctx = details.merchantContext as MerchantContext | undefined
    if (!ctx || typeof ctx !== 'object') return null

    return ctx
  }

  /**
   * 检查订单回调是否已完成（供 Processor 复用）
   */
  isCallbackCompleted(order: PaymentOrder): boolean {
    if (!order.merchantId || !order.callbackUrl) {
      return true // 非外部订单视为已完成
    }
    const ctx = this.getMerchantContext(order)
    return ctx?.callbackStatus === 'SUCCESS'
  }

  /**
   * 构建回调信息（供 Controller 使用）
   */
  buildCallbackInfo(order: PaymentOrder): {
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
  } {
    const ctx = this.getMerchantContext(order)

    const callbackStatus: CallbackStatus = ctx?.callbackStatus || 'PENDING'
    const callbackAttempts = ctx?.callbackAttempts || 0

    return {
      orderId: order.id,
      merchantId: order.merchantId || '',
      businessOrderId: order.businessOrderId || '',
      callbackUrl: order.callbackUrl || '',
      returnUrl: order.returnUrl || undefined,
      callbackStatus,
      callbackAttempts,
      lastCallbackAt: ctx?.lastCallbackAt,
      lastCallbackError: ctx?.lastCallbackError,
      // 只有失败状态且重试次数小于 3 才允许手动重试
      canRetry: callbackStatus === 'FAILED' && callbackAttempts < MAX_RETRY_ATTEMPTS,
    }
  }

  /**
   * 更新回调状态
   */
  private async updateCallbackStatus(
    orderId: string,
    currentContext: MerchantContext,
    status: CallbackStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updatedContext: Record<string, Prisma.JsonValue> = {
      ...currentContext,
      callbackStatus: status,
      // 使用 ?? 0 确保 undefined 时不会变成 NaN
      callbackAttempts: (currentContext.callbackAttempts ?? 0) + 1,
      lastCallbackAt: new Date().toISOString(),
      ...(errorMessage && { lastCallbackError: errorMessage }),
    }

    const existingOrder = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { paymentDetails: true },
    })

    const existingDetails = (existingOrder?.paymentDetails ?? {}) as Record<string, Prisma.JsonValue>

    await this.prisma.paymentOrder.update({
      where: { id: orderId },
      data: {
        paymentDetails: {
          ...existingDetails,
          merchantContext: updatedContext,
        },
      },
    })
  }

  /**
   * 从 URL 中安全提取域名（用于日志脱敏）
   */
  private getUrlHost(url: string): string {
    try {
      return new URL(url).host
    }
    catch {
      return '[invalid-url]'
    }
  }

  /**
   * 从订单中提取套餐信息
   *
   * @description
   * 从 paymentDetails.package 中提取套餐详情，供回调通知使用。
   * 套餐信息是用户在平台选购时记录的快照，包含完整的商品详情。
   */
  private extractProductInfo(order: PaymentOrder): CallbackProductInfo | null {
    const details = order.paymentDetails as Record<string, unknown> | null
    if (!details) return null

    const pkg = details.package as Record<string, unknown> | undefined
    if (!pkg || typeof pkg !== 'object') return null

    // 确保必要字段存在
    if (!pkg.id || !pkg.name || !pkg.displayTitle || !pkg.priceAmount) {
      return null
    }

    return {
      id: String(pkg.id),
      name: String(pkg.name),
      displayTitle: String(pkg.displayTitle),
      badgeLabel: pkg.badgeLabel ? String(pkg.badgeLabel) : undefined,
      priceAmount: String(pkg.priceAmount),
      priceCurrency: String(pkg.priceCurrency || 'USD'),
      baseScore: Number(pkg.baseScore) || 0,
      bonusScore: Number(pkg.bonusScore) || 0,
      totalScore: Number(pkg.totalScore) || 0,
    }
  }

  /**
   * 构建签名参数
   *
   * @description
   * 将 payload 和 productInfo 扁平化为签名参数。
   * productInfo 字段使用 `product_` 前缀扁平化，确保套餐信息参与签名防止篡改。
   */
  private buildSignPayload(
    payload: Omit<CallbackPayload, 'sign'>,
    productInfo: CallbackProductInfo | null,
  ): Record<string, string | number> {
    // 基础字段（排除 productInfo 对象）
    const { productInfo: _, ...basePayload } = payload as Omit<CallbackPayload, 'sign'> & { productInfo?: CallbackProductInfo }

    const signParams: Record<string, string | number> = {
      ...basePayload,
    }

    // 将 productInfo 扁平化为 product_xxx 字段参与签名
    if (productInfo) {
      signParams.product_id = productInfo.id
      signParams.product_name = productInfo.name
      signParams.product_displayTitle = productInfo.displayTitle
      if (productInfo.badgeLabel) {
        signParams.product_badgeLabel = productInfo.badgeLabel
      }
      signParams.product_priceAmount = productInfo.priceAmount
      signParams.product_priceCurrency = productInfo.priceCurrency
      signParams.product_baseScore = productInfo.baseScore
      signParams.product_bonusScore = productInfo.bonusScore
      signParams.product_totalScore = productInfo.totalScore
    }

    return signParams
  }
}
