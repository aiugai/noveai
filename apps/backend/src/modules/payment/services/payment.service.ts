import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { PaymentOrderRepository } from '../repositories/payment.order.repository'
import { CreatePaymentOrderRequestDto } from '../dto/requests/create.payment.order.request.dto'
import { PaymentOrderResponseDto, ExternalOrderPublicResponseDto, CallbackProductInfoDto  } from '../dto/responses/payment.order.response.dto'
import { IPaymentProvider } from '../interfaces/payment.provider.interface'
import { Prisma, PaymentOrder, PaymentOrderStatus, PaymentRechargePackage } from '@prisma/client'
import { WalletService } from '@/modules/wallet/wallet.service'
import { WalletDetailResponseDto } from '@/modules/wallet/dto/responses/wallet.detail.response.dto'
import { PAGINATION_CONSTANTS } from '@/common/constants/pagination.constants'
import { MockPaymentProvider } from '../providers/mock.payment.provider' // Import the mock
import { WGQPayProvider } from '../providers/wgqpay.payment.provider'
import { TransactionEventsService } from '@/common/services/transaction-events.service'
import { MessageBusService } from '@/modules/message-bus/message-bus.service'
import {
  TOPIC_ENGAGEMENT_EVENTS,
  TOPIC_PAYMENT_EVENTS,
} from '@/modules/message-bus/message-bus.topics'
import { ENGAGEMENT_EVENT, PAYMENT_EVENT } from '@/modules/message-bus/message-bus.event-types'
import type { DepositCompletedEventDto } from '@/modules/message-bus/dto/deposit-completed.event.dto'
import { PaymentChannel } from '../enums/payment.channel.enum'
import { PaymentMethod } from '../enums/payment.method.enum'
import { PaymentOptionsResponseDto } from '../dto/responses/payment.options.response.dto'
import { PaymentSettingsResolver } from './payment.settings.resolver'
import { RechargePackageService } from './recharge-package.service'
import { BasePaginationRequestDto } from '@/common/dto/base.pagination.request.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { WGQPayCallbackDto } from '../dto/requests/wgqpay.callback.request.dto'
import { PrismaService } from '@/prisma/prisma.service'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import {
  RechargePackageNotFoundException,
  RechargePackageCurrencyMismatchException,
  RechargePackagePriceMismatchException,
  ExternalPaymentDuplicateOrderException,
} from '../exceptions'
import { CreateExternalPaymentOrderDto } from '../dto/requests/create-external-payment-order.dto'
import { QueryExternalOrderStatusDto } from '../dto/requests/query-external-order-status.dto'
import { ExternalOrderStatusResponseDto } from '../dto/responses/external-order-status.response.dto'
import { PaymentExternalService } from './payment-external.service'

// Prisma 7 兼容：从 Prisma 命名空间获取 Decimal 类型（值和类型）
type Decimal = Prisma.Decimal
// eslint-disable-next-line no-redeclare, ts/no-redeclare
const Decimal = Prisma.Decimal

interface PaymentCallbackResult {
  ok: boolean
  idempotent?: boolean
  shouldAck: boolean
  reason?: string
  context?: Record<string, unknown>
}

interface CreatePaymentOrderOptions {
  forcedChannel?: PaymentChannel
}

/**
 * 充值套餐详情（存储在 paymentDetails.package 中）
 */
interface MembershipMetadata extends Record<string, Prisma.JsonValue> {
  type?: string
  membershipTier?: string
  durationDays?: number
}

interface RechargePackageDetails extends Record<string, Prisma.JsonValue | undefined> {
  id: string
  name: string
  displayTitle: string
  badgeLabel: string
  priceAmount: string
  priceCurrency: string
  baseScore: number
  bonusPercent: number
  bonusScore: number
  totalScore: number
  metadata?: MembershipMetadata | null
}

/**
 * 支付订单详情结构（paymentDetails JSONB 字段）
 */
interface PaymentDetailsStructure {
  requestedMethod?: string
  requested?: {
    amount: string
    currency: string
  }
  settled?: {
    amount: string
    currency: string
    rate?: string
  }
  package?: RechargePackageDetails
  [key: string]: unknown
}

const PAYLOAD_BLOCKLIST = new Set(['__proto__', 'prototype', 'constructor'])

/*
 * Callback acknowledgment matrix (shouldAck = true -> controller returns 200/SUCCESS):
 *   - Signature/format/merchant mismatch, replay detection: shouldAck = false (ask provider to retry)
 *   - Idempotent callbacks: shouldAck = true (already processed)
 *   - Business validation failure (amount/currency mismatch, dto validation): shouldAck = true (we persist FAILED)
 *   - Successful state transitions (PENDING->COMPLETED etc.): shouldAck = true
 *   - Unexpected internal errors: shouldAck = false (allow provider retry)
 */
// 最小上线方案：不在运行时读取前端源码，而是一次性“固化”允许的 USD 套餐价格

@Injectable()
export class PaymentService {
  private providers: Map<string, IPaymentProvider> = new Map()
  private readonly logger = new Logger(PaymentService.name)

  private static readonly USD = 'USD'
  private static readonly CNY = 'CNY'
  private static readonly CALLBACK_LOG_MAX_LEN = 2000

  constructor(
    private readonly paymentOrderRepository: PaymentOrderRepository,
    private readonly walletService: WalletService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly wgqpayProvider: WGQPayProvider,
    private readonly bus: MessageBusService,
    private readonly rechargePackageService: RechargePackageService,
    private readonly resolver: PaymentSettingsResolver,
    private readonly txEvents: TransactionEventsService,
    private readonly prisma: PrismaService,
    private readonly paymentExternalService: PaymentExternalService,
  ) {
    // Register providers
    if (this.mockProvider) this.providers.set(this.mockProvider.channel, this.mockProvider)
    if (this.wgqpayProvider) this.providers.set(this.wgqpayProvider.channel, this.wgqpayProvider)
    // if (this.stripeProvider) this.providers.set(this.stripeProvider.channel, this.stripeProvider);
    this.logger.log(`Registered payment providers: ${Array.from(this.providers.keys()).join(', ')}`)
  }

  private badRequest(message: string, args?: Record<string, unknown>): never {
    throw new DomainException(message, {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
      args,
    })
  }

  private notFound(message: string, args?: Record<string, unknown>): never {
    throw new DomainException(message, {
      code: ErrorCode.NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
      args,
    })
  }

  // --- Public API Methods --- //

  async getPaymentOptions(): Promise<PaymentOptionsResponseDto> {
    const methodsRaw = await this.resolver.getActivePaymentMethods()
    const methods = methodsRaw
      .map(m => m.toUpperCase())
      .filter((m): m is keyof typeof PaymentMethod => m in PaymentMethod)
      .map(m => PaymentMethod[m as keyof typeof PaymentMethod])

    const targetAssetCodes = await this.walletService.listActiveAssetTypeCodes()

    // 当前策略：统一结算货币 USD（如有多币种支持，可从设置中心读取）
    const settlementCurrency = 'USD'
    const packagesRaw = await this.rechargePackageService.getActivePackages()
    const packages = packagesRaw.map(pkg => {
      const priceAmount = pkg.priceAmount.toFixed(2)
      const bonusScore = pkg.totalScore - pkg.baseScore
      return {
        id: pkg.id,
        displayTitle: pkg.displayTitle,
        badgeLabel: pkg.badgeLabel,
        priceAmount,
        priceCurrency: pkg.priceCurrency,
        baseScore: pkg.baseScore,
        bonusPercent: pkg.bonusPercent,
        bonusScore,
        totalScore: pkg.totalScore,
        sortOrder: pkg.sortOrder,
      }
    })

    const exchangeRate = await this.resolver.getUsdToCnyRate()

    return { methods, targetAssetCodes, settlementCurrency, packages, exchangeRate }
  }

  async createPaymentOrder(
    userId: string,
    dto: CreatePaymentOrderRequestDto,
    options: CreatePaymentOrderOptions = {},
  ): Promise<PaymentOrderResponseDto> {
    const requestCurrency = String(dto.currency || '').toUpperCase()
    this.logger.log(
      `Creating payment order user=${userId} method=${String(dto.method).toUpperCase()} amount=${dto.amount} currency=${requestCurrency} targetAsset=${dto.targetAssetCode ?? 'N/A'}`,
    )
    // 校验前端传入的支付方式是否在启用列表（防止前端与后端设置不一致导致语义混乱）
    // 注意：当使用 MOCK 通道进行模拟充值时（forcedChannel === PaymentChannel.MOCK），
    // 不依赖具体支付方式进行外部路由，因此可以跳过该校验，避免测试环境关闭某些 method 时导致模拟失败。
    if (!options.forcedChannel || options.forcedChannel !== PaymentChannel.MOCK) {
      const activeMethods = await this.resolver.getActivePaymentMethods()
      const methodUpper = String(dto.method).toUpperCase()
      if (!activeMethods.includes(methodUpper)) {
        this.badRequest(`Unsupported payment method: ${dto.method}`)
      }
    }

    // 仅单通道：从设置读取激活通道
    const activeChannel = options.forcedChannel ?? (await this.getActiveChannel())
    // 某些渠道要求显式目标资产信息
    if (activeChannel === PaymentChannel.WGQPAY && !dto.targetAssetCode) {
      this.badRequest('WGQPAY 渠道必须提供 targetAssetCode')
    }
    const provider = this.getProvider(activeChannel)
    this.logger.debug(
      `Resolved active channel=${activeChannel} provider=${provider.constructor.name} for user=${userId}`,
    )

    let targetAssetTypeId: string | undefined
    if (dto.targetAssetCode) {
      const assetType = await this.walletService.findAssetTypeByCode(dto.targetAssetCode)
      if (!assetType) {
        this.notFound(`Asset type with code '${dto.targetAssetCode}' not found.`, {
          targetAssetCode: dto.targetAssetCode,
        })
      }
      targetAssetTypeId = assetType.id
    }
    // 1) 快速校验：若前端传 USD，则金额必须在套餐价格中，且小数位不超过 2 位；其他货币不改变精度
    const originalAmountDec = this.parseAmountDecimal(dto.amount)
    if (!originalAmountDec.gt(0)) {
      this.badRequest('金额必须大于 0')
    }

    let rechargePackage: PaymentRechargePackage | null = null
    let targetAssetAmountCalculated: Decimal = originalAmountDec
    let packageSnapshot: RechargePackageDetails | null = null

    const amountFixed = requestCurrency === PaymentService.USD ? originalAmountDec.toFixed(2) : null

    if (requestCurrency === PaymentService.USD && !this.hasAtMostTwoDecimals(dto.amount)) {
      this.badRequest('非法金额精度：USD 金额最多支持两位小数', {
        amount: dto.amount,
      })
    }

    if (dto.packageId) {
      rechargePackage = await this.rechargePackageService.findById(dto.packageId)
      if (!rechargePackage || rechargePackage.status !== 'ACTIVE') {
        throw new RechargePackageNotFoundException({ packageId: dto.packageId })
      }

      const packageCurrency = rechargePackage.priceCurrency.toUpperCase()
      if (requestCurrency !== packageCurrency) {
        throw new RechargePackageCurrencyMismatchException({
          packageCurrency,
          requestCurrency,
        })
      }

      if (amountFixed && rechargePackage.priceAmount.toFixed(2) !== amountFixed) {
        throw new RechargePackagePriceMismatchException({
          packagePrice: rechargePackage.priceAmount.toFixed(2),
          requestAmount: amountFixed,
        })
      }
    } else if (requestCurrency === PaymentService.USD && amountFixed) {
      rechargePackage = await this.rechargePackageService.findByPrice(amountFixed, requestCurrency)
      if (!rechargePackage) {
        throw new RechargePackageNotFoundException({ amount: amountFixed })
      }
      if (rechargePackage.status !== 'ACTIVE') {
        throw new RechargePackageNotFoundException({ packageId: rechargePackage.id })
      }
    }

    if (rechargePackage) {
      targetAssetAmountCalculated = new Decimal(rechargePackage.totalScore)
      const priceAmount = rechargePackage.priceAmount.toFixed(2)
      const bonusScore = rechargePackage.totalScore - rechargePackage.baseScore
      const metadata = (rechargePackage.metadata ?? null) as unknown as MembershipMetadata | null
      packageSnapshot = {
        id: rechargePackage.id,
        name: rechargePackage.name,
        displayTitle: rechargePackage.displayTitle,
        badgeLabel: rechargePackage.badgeLabel,
        priceAmount,
        priceCurrency: rechargePackage.priceCurrency,
        baseScore: rechargePackage.baseScore,
        bonusPercent: rechargePackage.bonusPercent,
        bonusScore,
        totalScore: rechargePackage.totalScore,
        ...(metadata && { metadata }),
      }

      this.logger.log(
        `Recharge package matched: ${rechargePackage.badgeLabel}, price=${priceAmount} ${rechargePackage.priceCurrency}, ` +
        `baseScore=${rechargePackage.baseScore}, bonus=${rechargePackage.bonusPercent}%, ` +
        `totalScore=${rechargePackage.totalScore}`,
      )
    }

    // 2) 按渠道做结算币种与金额换算（最小方案：USD 请求在 WGQPAY 下转 CNY）；非 USD 保留原始精度
    let settleCurrency = requestCurrency
    let settleAmount = originalAmountDec
    let settleRate: number | undefined
    if (activeChannel === PaymentChannel.WGQPAY && requestCurrency === PaymentService.USD) {
      const rate = await this.resolver.getUsdToCnyRate()
      const cnyAmount = originalAmountDec.mul(rate)
      const cnyFixedStr = cnyAmount.toFixed(2)
      settleAmount = new Decimal(cnyFixedStr)
      settleCurrency = PaymentService.CNY
      settleRate = rate
      this.logger.log(
        `WGQPAY 结算金额换算：USD ${originalAmountDec.toFixed(2)} * rate ${rate} = CNY ${cnyFixedStr}`,
      )
    }

    const settledDetails: Record<string, string | number> = {
      amount: settleAmount.toString(),
      currency: settleCurrency,
      ...(settleRate !== undefined && { rate: settleRate }),
    }

    // 注意：外部商户订单现在通过 PaymentExternalService.initExternalPaymentSession 直接创建
    // 此方法仅处理内部用户的充值订单

    const paymentDetails = {
      requestedMethod: String(dto.method),
      requested: { amount: dto.amount, currency: dto.currency },
      settled: settledDetails,
      ...(rechargePackage && { packageId: rechargePackage.id }),
      ...(packageSnapshot && { package: packageSnapshot }),
    } satisfies Prisma.JsonObject

    const orderData: Prisma.PaymentOrderCreateInput = {
      user: { connect: { id: userId } },
      amount: settleAmount,
      currency: settleCurrency,
      channel: activeChannel,
      status: PaymentOrderStatus.PENDING,
      // 记录请求/结算信息，便于审计与排障
      paymentDetails,
      ...(targetAssetTypeId && { targetAssetType: { connect: { id: targetAssetTypeId } } }),
      // ✅ 使用计算后的完整金额
      ...(targetAssetTypeId && {
        targetAssetAmount: targetAssetAmountCalculated,
        exchangeRate: new Decimal(1),
      }),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // Add back expiresAt (Example: 15 mins)
      // 注：外部商户订单由 PaymentExternalService.initExternalPaymentSession() 直接创建
    }

    let paymentOrder = await this.paymentOrderRepository.create(orderData)
    this.logger.log(
      `Payment order created orderId=${paymentOrder.id} channel=${paymentOrder.channel} settleAmount=${paymentOrder.amount} settleCurrency=${paymentOrder.currency} targetAsset=${dto.targetAssetCode ?? 'N/A'}`,
    )

    try {
      const paymentResult = await provider.createPayment(paymentOrder)
      this.logger.debug(
        `Provider createPayment completed orderId=${paymentOrder.id} externalOrderId=${paymentResult.externalOrderId ?? 'N/A'} status=${paymentResult.status}`,
      )

      // ✅ 安全合并 paymentDetails，保留 package 信息并过滤危险键
      const mergedPaymentDetails = this.mergePaymentDetails(
        paymentOrder.paymentDetails,
        {
          requestedMethod: dto.method,
          requested: { amount: dto.amount, currency: dto.currency },
          settled: { amount: settleAmount.toString(), currency: settleCurrency, rate: settleRate },
          ...(rechargePackage && { packageId: rechargePackage.id }),
          ...(packageSnapshot && { package: packageSnapshot }),
          ...paymentResult.paymentDetails,
        },
        true, // 保留 package
      )

      const updateData: Prisma.PaymentOrderUpdateInput = {
        externalOrderId: paymentResult.externalOrderId,
        paymentDetails: mergedPaymentDetails as Prisma.JsonObject,
        status:
          paymentResult.status === 'COMPLETED'
            ? PaymentOrderStatus.COMPLETED
            : PaymentOrderStatus.PENDING,
      }
      paymentOrder = await this.paymentOrderRepository.update(paymentOrder.id, updateData)

      if (paymentOrder.status === PaymentOrderStatus.COMPLETED) {
        this.logger.log(`Payment order auto-completed during creation orderId=${paymentOrder.id}`)
        await this.processSuccessfulPayment(paymentOrder)
      }

      return new PaymentOrderResponseDto(paymentOrder)
    } catch (error) {
      await this.paymentOrderRepository.update(paymentOrder.id, {
        status: PaymentOrderStatus.FAILED,
      })
      this.logger.error(
        `Failed to create payment with ${activeChannel}: ${(error as Error).message}`,
        (error as Error).stack,
      )
      throw new DomainException(`Failed to initiate payment with ${activeChannel}`, {
        code: ErrorCode.PAYMENT_INITIATION_FAILED,
        args: { channel: activeChannel },
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }
  }

  /**
   * 创建外部商户支付订单
   *
   * @description
   * 用于外部商户模式：用户在 /recharge 页面选择商品后创建订单
   * - 验证签名和时间戳
   * - 创建订单并发起支付
   * - 记录商户上下文和签名数据用于审计
   *
   * @param dto - 外部支付请求参数（含签名）
   * @returns 支付订单响应
   */
  async createExternalPaymentOrder(
    dto: CreateExternalPaymentOrderDto,
  ): Promise<PaymentOrderResponseDto> {
    this.logger.log(
      `Creating external payment order merchantId=${dto.merchantId} businessOrderId=${dto.businessOrderId} packageId=${dto.packageId}`,
    )

    // 1. 验证签名和商户配置
    const { callbackUrl, merchantContext, signatureData }
      = await this.paymentExternalService.validateExternalRequest(dto)

    // 2. 幂等性检查：相同 merchantId + businessOrderId 返回已有订单
    const existingOrder = await this.paymentOrderRepository.findByMerchantOrder(
      dto.merchantId,
      dto.businessOrderId,
    )
    if (existingOrder) {
      this.logger.log(
        `外部订单幂等性命中: merchantId=${dto.merchantId}, businessOrderId=${dto.businessOrderId}, existingOrderId=${existingOrder.id}`,
      )
      // 如果订单已存在且状态是 PENDING，直接返回
      if (existingOrder.status === PaymentOrderStatus.PENDING) {
        return new PaymentOrderResponseDto(existingOrder)
      }
      // 如果订单已完成或失败，抛出重复订单异常
      throw new ExternalPaymentDuplicateOrderException(dto.merchantId, dto.businessOrderId)
    }

    // 3. 查找套餐信息（必需，金额从套餐获取，防止前端篡改）
    const rechargePackage = await this.rechargePackageService.findById(dto.packageId)
    if (!rechargePackage || rechargePackage.status !== 'ACTIVE') {
      throw new RechargePackageNotFoundException({ packageId: dto.packageId })
    }

    // 4. 从套餐获取金额（安全：金额来自数据库，非前端传递）
    const amountYuan = new Decimal(rechargePackage.priceAmount)
    const targetAssetAmount = new Decimal(rechargePackage.totalScore)
    const bonusScore = rechargePackage.totalScore - rechargePackage.baseScore
    const metadata = (rechargePackage.metadata ?? null) as unknown as MembershipMetadata | null

    const packageSnapshot: RechargePackageDetails = {
      id: rechargePackage.id,
      name: rechargePackage.name,
      displayTitle: rechargePackage.displayTitle,
      badgeLabel: rechargePackage.badgeLabel,
      priceAmount: rechargePackage.priceAmount.toFixed(2),
      priceCurrency: rechargePackage.priceCurrency,
      baseScore: rechargePackage.baseScore,
      bonusPercent: rechargePackage.bonusPercent,
      bonusScore,
      totalScore: rechargePackage.totalScore,
      ...(metadata && { metadata }),
    }

    this.logger.log(
      `外部订单使用套餐: packageId=${rechargePackage.id}, price=${amountYuan.toString()} ${rechargePackage.priceCurrency}`,
    )

    // 5. 获取支付渠道
    const activeChannel = await this.getActiveChannel()
    const provider = this.getProvider(activeChannel)

    // 6. 获取目标资产类型
    const defaultAssetCode = 'DIAMOND' // 默认资产类型
    const assetType = await this.walletService.findAssetTypeByCode(defaultAssetCode)
    const targetAssetTypeId = assetType?.id

    // 7. 按渠道做结算币种与金额换算
    let settleCurrency = PaymentService.USD
    let settleAmount = amountYuan
    let settleRate: number | undefined

    if (activeChannel === PaymentChannel.WGQPAY) {
      const rate = await this.resolver.getUsdToCnyRate()
      const cnyAmount = amountYuan.mul(rate)
      settleAmount = new Decimal(cnyAmount.toFixed(2))
      settleCurrency = PaymentService.CNY
      settleRate = rate
    }

    // 8. 构建支付详情
    // 补充 merchantContext 中回调所需的字段
    const enrichedMerchantContext = {
      ...merchantContext,
      amount: amountYuan.toString(), // USD 金额，用于回调签名
      callbackStatus: 'PENDING' as const,
      callbackAttempts: 0,
    }

    const paymentDetails = {
      requested: { amount: amountYuan.toString(), currency: PaymentService.USD },
      settled: {
        amount: settleAmount.toString(),
        currency: settleCurrency,
        ...(settleRate !== undefined && { rate: settleRate }),
      },
      merchantContext: enrichedMerchantContext as unknown as Prisma.JsonObject,
      packageId: rechargePackage.id,
      package: packageSnapshot as unknown as Prisma.JsonObject,
    } satisfies Prisma.JsonObject

    // 9. 创建订单
    const orderData: Prisma.PaymentOrderCreateInput = {
      // 外部商户订单没有内部用户
      amount: settleAmount,
      currency: settleCurrency,
      channel: activeChannel,
      status: PaymentOrderStatus.PENDING,
      paymentDetails,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      // 商户追踪字段
      merchantId: dto.merchantId,
      businessOrderId: dto.businessOrderId,
      callbackUrl,
      returnUrl: dto.retUrl,
      // 外部支付扩展字段
      sourceType: 'EXTERNAL',
      signatureData: signatureData as unknown as Prisma.JsonObject,
      // 目标资产
      ...(targetAssetTypeId && {
        targetAssetType: { connect: { id: targetAssetTypeId } },
        targetAssetAmount,
        exchangeRate: new Decimal(1),
      }),
    }

    let paymentOrder: PaymentOrder
    try {
      paymentOrder = await this.paymentOrderRepository.create(orderData)
    }
    catch (error) {
      // 捕获唯一约束冲突（并发创建）
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        const conflictOrder = await this.paymentOrderRepository.findByMerchantOrder(
          dto.merchantId,
          dto.businessOrderId,
        )
        if (conflictOrder) {
          return new PaymentOrderResponseDto(conflictOrder)
        }
      }
      throw error
    }

    this.logger.log(
      `External payment order created orderId=${paymentOrder.id} merchantId=${dto.merchantId} businessOrderId=${dto.businessOrderId}`,
    )

    // 10. 调用支付提供商
    try {
      const paymentResult = await provider.createPayment(paymentOrder)

      const mergedPaymentDetails = this.mergePaymentDetails(
        paymentOrder.paymentDetails,
        {
          ...paymentDetails,
          ...paymentResult.paymentDetails,
        },
        true,
      )

      // 根据支付网关返回的状态确定订单状态
      let orderStatus: PaymentOrderStatus
      let completedAt: Date | undefined

      if (paymentResult.status === 'COMPLETED') {
        orderStatus = PaymentOrderStatus.COMPLETED
        completedAt = new Date()
      }
      else if (paymentResult.status === 'FAILED') {
        orderStatus = PaymentOrderStatus.FAILED
        completedAt = new Date()
      }
      else {
        orderStatus = PaymentOrderStatus.PENDING
      }

      const updateData: Prisma.PaymentOrderUpdateInput = {
        externalOrderId: paymentResult.externalOrderId,
        paymentDetails: mergedPaymentDetails as Prisma.JsonObject,
        status: orderStatus,
        ...(completedAt && { completedAt }),
      }
      paymentOrder = await this.paymentOrderRepository.update(paymentOrder.id, updateData)

      // 如果支付网关同步返回失败，抛出错误通知调用方
      if (paymentOrder.status === PaymentOrderStatus.FAILED) {
        throw new DomainException('Payment gateway returned failed status', {
          code: ErrorCode.PAYMENT_INITIATION_FAILED,
          args: {
            merchantId: dto.merchantId,
            reason: 'Payment gateway rejected the payment request',
          },
          status: HttpStatus.BAD_REQUEST,
        })
      }

      if (paymentOrder.status === PaymentOrderStatus.COMPLETED) {
        await this.processSuccessfulPayment(paymentOrder)
      }

      return new PaymentOrderResponseDto(paymentOrder)
    }
    catch (error) {
      // 无论是业务异常还是未知异常，都需要把订单标记为 FAILED
      // 这样商户才能按预期重新创建订单，幂等逻辑才能正常工作
      await this.paymentOrderRepository.update(paymentOrder.id, {
        status: PaymentOrderStatus.FAILED,
        completedAt: new Date(),
      })

      // 如果是业务异常（如支付网关拒绝），透传原始错误码和状态码
      if (error instanceof DomainException) {
        throw error
      }

      // 对未知异常包装成 500
      this.logger.error(
        `Failed to create external payment: ${(error as Error).message}`,
        (error as Error).stack,
      )
      throw new DomainException(`Failed to initiate external payment`, {
        code: ErrorCode.PAYMENT_INITIATION_FAILED,
        args: { merchantId: dto.merchantId },
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }
  }

  /**
   * 创建外部商户支付订单（公开版）
   *
   * @description
   * 包装 createExternalPaymentOrder，返回精简版 DTO
   * 仅包含前端所需的非敏感信息
   *
   * @param dto - 创建外部订单请求
   * @returns 精简版订单信息（不含敏感商户数据）
   */
  async createExternalPaymentOrderPublic(
    dto: CreateExternalPaymentOrderDto,
  ): Promise<ExternalOrderPublicResponseDto> {
    const fullResponse = await this.createExternalPaymentOrder(dto)
    // 从完整响应中提取订单，转换为精简版
    // createExternalPaymentOrder 返回的是 PaymentOrderResponseDto，需要从数据库重新获取 PaymentOrder
    const order = await this.paymentOrderRepository.findById(fullResponse.id)
    if (!order) {
      // 这种情况理论上不应发生，因为刚刚创建了订单
      this.notFound(`Order with ID '${fullResponse.id}' not found.`, { orderId: fullResponse.id })
    }
    return new ExternalOrderPublicResponseDto(order)
  }

  /**
   * 查询外部订单状态
   *
   * @description
   * 外部商户查询订单状态
   * - 验证签名和时间戳
   * - 返回订单状态和商品信息
   *
   * @param dto - 查询请求参数（含签名）
   * @returns 订单状态响应
   */
  async queryExternalOrderStatus(
    dto: QueryExternalOrderStatusDto,
  ): Promise<ExternalOrderStatusResponseDto> {
    // 1. 验证签名和商户配置
    await this.paymentExternalService.validateQueryRequest(dto)

    // 2. 查询订单
    const order = await this.paymentOrderRepository.findByMerchantOrder(
      dto.merchantId,
      dto.businessOrderId,
    )

    if (!order) {
      throw new DomainException('External order not found', {
        code: ErrorCode.EXTERNAL_PAYMENT_ORDER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: {
          merchantId: dto.merchantId,
          businessOrderId: dto.businessOrderId,
        },
      })
    }

    // 3. 转换状态
    let status: 'pending' | 'success' | 'failed'
    switch (order.status) {
      case PaymentOrderStatus.COMPLETED:
        status = 'success'
        break
      case PaymentOrderStatus.FAILED:
      case PaymentOrderStatus.CANCELLED:
      case PaymentOrderStatus.EXPIRED:
        status = 'failed'
        break
      default:
        status = 'pending'
    }

    // 4. 提取完整商品信息（与回调通知结构一致）
    let productInfo: CallbackProductInfoDto | undefined
    const details = order.paymentDetails as PaymentDetailsStructure | null
    if (details?.package) {
      productInfo = {
        id: details.package.id ?? '',
        name: details.package.name,
        displayTitle: details.package.displayTitle,
        badgeLabel: details.package.badgeLabel,
        priceAmount: details.package.priceAmount,
        priceCurrency: details.package.priceCurrency ?? 'USD',
        baseScore: details.package.baseScore ?? 0,
        bonusScore: details.package.bonusScore ?? 0,
        totalScore: details.package.totalScore ?? 0,
      }
    }

    return new ExternalOrderStatusResponseDto({
      status,
      productInfo,
      paidAt: order.completedAt,
    })
  }

  async handlePaymentCallback(
    channel: PaymentChannel,
    payload: Record<string, unknown>,
  ): Promise<PaymentCallbackResult> {
    this.logger.debug(
      `Processing callback channel=${channel} payloadPreview=${this.stringifyForLog(payload)}`,
    )
    let merchantOrderId = 'unknown'
    try {
      const provider = this.getProvider(channel)
      const updatePayload = await provider.handleCallback(payload)
      if (!updatePayload) {
        this.logger.warn(
          `Provider ${channel} returned empty callback payload. raw=${this.stringifyForLog(payload)}`,
        )
        return { ok: false, shouldAck: false, reason: 'PROVIDER_REJECTED' }
      }
      const callbackJson = payload as unknown as Prisma.JsonObject
      merchantOrderId = this.pickStringField(payload, 'merchant_order_id') ?? 'unknown'

      // 优先通过 externalOrderId 查找，否则回退到本地订单ID
      let order: PaymentOrder | null = null
      if (updatePayload.externalOrderId) {
        order = await this.paymentOrderRepository.findByExternalOrderId(
          updatePayload.externalOrderId,
        )
      }
      if (!order && (updatePayload as any).id) {
        order = await this.paymentOrderRepository.findById((updatePayload as any).id as string)
      }
      if (!order) {
        this.logger.warn(
          `Callback order not found channel=${channel} merchantOrderId=${merchantOrderId} externalOrderId=${updatePayload.externalOrderId}`,
        )
        this.notFound('Order not found for callback.', {
          channel,
          merchantOrderId,
          externalOrderId: updatePayload.externalOrderId,
        })
      }
      this.logger.debug(
        `Callback resolved order channel=${channel} orderId=${order.id} externalOrderId=${order.externalOrderId} status=${order.status} updateStatus=${(updatePayload as any).status}`,
      )
      if (
        order.status === PaymentOrderStatus.COMPLETED ||
        order.status === PaymentOrderStatus.FAILED
      ) {
        // 幂等命中：已是终态
        this.logger.log(
          `Callback idempotent hit channel=${channel} orderId=${order.id} externalOrderId=${order.externalOrderId}`,
        )
        return { ok: true, idempotent: true, shouldAck: true, reason: 'IDEMPOTENT' }
      }

      // 金额与币种一致性校验（若回调提供）
      try {
        const cbAmountRaw = (updatePayload as any).payAmount ?? (updatePayload as any).amount
        if (cbAmountRaw !== undefined && cbAmountRaw !== null) {
          const cbAmount = new Decimal(cbAmountRaw)
          const orderAmount = new Decimal(order.amount)
          if (!cbAmount.equals(orderAmount)) {
            await this.paymentOrderRepository.update(order.id, {
              status: PaymentOrderStatus.FAILED,
              callbackData: callbackJson,
              completedAt: new Date(),
            })
            this.logger.warn(
              `Callback amount mismatch order=${order.id} externalOrderId=${order.externalOrderId} merchantOrderId=${merchantOrderId} expected=${orderAmount.toString()} got=${cbAmount.toString()}`,
            )
            return {
              ok: false,
              shouldAck: true,
              reason: 'AMOUNT_MISMATCH',
              context: { expected: orderAmount.toString(), got: cbAmount.toString() },
            }
          }
        }
        const cbCurrency = (updatePayload as any).currency
        if (
          cbCurrency &&
          String(cbCurrency).toUpperCase() !== String(order.currency).toUpperCase()
        ) {
          await this.paymentOrderRepository.update(order.id, {
            status: PaymentOrderStatus.FAILED,
            callbackData: callbackJson,
            completedAt: new Date(),
          })
          this.logger.warn(
            `Callback currency mismatch order=${order.id} externalOrderId=${order.externalOrderId} merchantOrderId=${merchantOrderId} expected=${order.currency} got=${cbCurrency}`,
          )
          return {
            ok: false,
            shouldAck: true,
            reason: 'CURRENCY_MISMATCH',
            context: { expected: order.currency, got: cbCurrency },
          }
        }
      } catch (e) {
        this.logger.warn(
          `Callback validation error order=${order.id} externalOrderId=${order.externalOrderId} merchantOrderId=${merchantOrderId}: ${(e as Error).message}`,
        )
        // 验证异常按失败处理
        await this.paymentOrderRepository.update(order.id, {
          status: PaymentOrderStatus.FAILED,
          callbackData: callbackJson,
          completedAt: new Date(),
        })
        return {
          ok: false,
          shouldAck: true,
          reason: 'VALIDATION_ERROR',
          context: { message: (e as Error).message },
        }
      }

      // ✅ 安全合并 paymentDetails，保留 package 信息并过滤危险键
      const mergedPaymentDetails = this.mergePaymentDetails(
        order.paymentDetails,
        {},
        true, // 保留 package
      )

      const finalUpdateData: Prisma.PaymentOrderUpdateInput = {
        status: updatePayload.status as PaymentOrderStatus,
        callbackData: callbackJson,
        completedAt:
          updatePayload.status === PaymentOrderStatus.COMPLETED ||
            updatePayload.status === PaymentOrderStatus.FAILED
            ? new Date()
            : undefined,
        targetAssetAmount: (updatePayload as any).targetAssetAmount
          ? new Decimal((updatePayload as any).targetAssetAmount)
          : undefined,
        exchangeRate: (updatePayload as any).exchangeRate
          ? new Decimal((updatePayload as any).exchangeRate)
          : undefined,
        externalOrderId: updatePayload.externalOrderId ?? order.externalOrderId,
        paymentDetails: mergedPaymentDetails as Prisma.JsonObject,
      }

      const updatedOrder = await this.paymentOrderRepository.update(order.id, finalUpdateData)
      this.logger.log(
        `Callback handled channel=${channel} orderId=${order.id} externalOrderId=${updatedOrder.externalOrderId} status=${updatedOrder.status}`,
      )

      if (updatedOrder.status === PaymentOrderStatus.COMPLETED) {
        await this.processSuccessfulPayment(updatedOrder)
      }
      return {
        ok: true,
        shouldAck: true,
        reason: 'UPDATED',
        context: { status: updatedOrder.status, orderId: order.id },
      }
    } catch (error) {
      this.logger.error(
        `Error handling ${channel} callback merchantOrderId=${merchantOrderId}: ${(error as Error).message}`,
        (error as Error).stack,
      )
      return {
        ok: false,
        shouldAck: false,
        reason: 'UNEXPECTED_ERROR',
        context: { merchantOrderId, message: (error as Error).message },
      }
    }
  }

  async getPaymentOrderById(id: string, userId: string): Promise<PaymentOrderResponseDto> {
    const order = await this.paymentOrderRepository.findById(id)
    if (!order || order.userId !== userId) {
      this.notFound(`PaymentOrder with ID '${id}' not found.`, { id })
    }
    return new PaymentOrderResponseDto(order)
  }

  /**
   * 获取外部订单详情（公开接口）
   *
   * @description
   * 供外部商户模式前端轮询订单状态使用
   * - 仅允许查询外部商户创建的订单（sourceType = EXTERNAL）
   * - 通过订单 ID 直接查询，无需签名验证
   *
   * @param orderId - 订单 ID
   * @returns 订单详情
   * @throws NotFound 订单不存在或非外部订单
   */
  async getExternalOrderById(orderId: string): Promise<PaymentOrderResponseDto> {
    const order = await this.paymentOrderRepository.findById(orderId)

    // 仅允许查询外部商户创建的订单
    if (!order || order.sourceType !== 'EXTERNAL') {
      throw new DomainException('External order not found', {
        code: ErrorCode.EXTERNAL_PAYMENT_ORDER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { orderId },
      })
    }

    return new PaymentOrderResponseDto(order)
  }

  /**
   * 查询外部订单（公开接口，精简版）
   *
   * @description
   * 供外部商户模式前端轮询订单状态使用
   * - 仅允许查询外部商户创建的订单
   * - 返回精简 DTO，不包含敏感商户信息（callbackUrl、merchantContext 等）
   *
   * @param orderId - 订单 ID
   * @returns 精简订单详情
   * @throws NotFound 订单不存在或非外部订单
   */
  async getExternalOrderByIdPublic(orderId: string): Promise<ExternalOrderPublicResponseDto> {
    const order = await this.paymentOrderRepository.findById(orderId)

    // 仅允许查询外部商户创建的订单
    if (!order || order.sourceType !== 'EXTERNAL') {
      throw new DomainException('External order not found', {
        code: ErrorCode.EXTERNAL_PAYMENT_ORDER_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { orderId },
      })
    }

    return new ExternalOrderPublicResponseDto(order)
  }

  async getMyOrders(
    userId: string,
    { page = 1, limit = 20 }: BasePaginationRequestDto,
  ): Promise<BasePaginationResponseDto<PaymentOrderResponseDto>> {
    const safePage = Math.max(1, Number(page) || 1)
    // 限制上限（性能考虑，防止单次查询数据量过大）
    const safeLimit = Math.min(PAGINATION_CONSTANTS.MAX_PAGE_SIZE, Math.max(1, Number(limit) || 20))
    const { total, items } = await this.paymentOrderRepository.findByUserPaginated(
      userId,
      safePage,
      safeLimit,
    )
    const dtos = items.map(o => new PaymentOrderResponseDto(o))
    return new BasePaginationResponseDto(total, safePage, safeLimit, dtos)
  }

  prepareCallbackPayload(
    channel: PaymentChannel,
    dto: WGQPayCallbackDto,
    raw: Record<string, unknown>,
  ): Record<string, unknown> {
    const sanitizedRaw = this.sanitizeRawPayload(raw)
    const dtoRecord = this.dtoToRecord(dto)
    // WGQPAY 需要原始字段参与签名，故 raw 优先覆盖 DTO
    return { ...dtoRecord, ...sanitizedRaw }
  }

  private sanitizeRawPayload(raw: Record<string, unknown>): Record<string, unknown> {
    if (!raw) return {}
    return Object.entries(raw).reduce<Record<string, unknown>>((acc, [key, value]) => {
      if (PAYLOAD_BLOCKLIST.has(key)) return acc
      acc[key] = value
      return acc
    }, {})
  }

  /**
   * 验证充值套餐详情的合法性
   */
  private validateRechargePackage(pkg: unknown): pkg is RechargePackageDetails {
    if (!pkg || typeof pkg !== 'object') return false
    const p = pkg as Record<string, unknown>
    return (
      typeof p.id === 'string' &&
      typeof p.displayTitle === 'string' &&
      typeof p.badgeLabel === 'string' &&
      typeof p.priceAmount === 'string' &&
      typeof p.priceCurrency === 'string' &&
      typeof p.baseScore === 'number' &&
      p.baseScore > 0 &&
      typeof p.bonusPercent === 'number' &&
      p.bonusPercent >= 0 &&
      p.bonusPercent <= 100 &&
      typeof p.bonusScore === 'number' &&
      p.bonusScore >= 0 &&
      typeof p.totalScore === 'number' &&
      p.totalScore > 0
    )
  }

  /**
   * 安全合并 paymentDetails，保留 package 信息并过滤危险键
   */
  private mergePaymentDetails(
    existing: unknown,
    updates: unknown,
    preservePackage: boolean = true,
  ): PaymentDetailsStructure {
    const existingDetails = (existing || {}) as PaymentDetailsStructure
    const updateDetails = this.sanitizeRawPayload((updates || {}) as Record<string, unknown>)

    // 提取并验证现有的 package 信息
    const existingPackage = existingDetails.package
    const validPackage =
      preservePackage && existingPackage && this.validateRechargePackage(existingPackage)
        ? existingPackage
        : undefined

    // 合并并保留 package
    const merged: PaymentDetailsStructure = {
      ...existingDetails,
      ...updateDetails,
    }

    // 强制保留已验证的 package
    if (validPackage) {
      merged.package = validPackage
    }

    return merged
  }

  private dtoToRecord(dto: WGQPayCallbackDto): Record<string, unknown> {
    return Object.entries(dto).reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = value
      return acc
    }, {})
  }

  private pickStringField(obj: Record<string, unknown>, key: string): string | undefined {
    const value = obj[key]
    return typeof value === 'string' ? value : undefined
  }

  private stringifyForLog(value: unknown): string {
    try {
      const serialized = JSON.stringify(value)
      if (!serialized) return '[empty]'
      return serialized.length > PaymentService.CALLBACK_LOG_MAX_LEN
        ? `${serialized.slice(0, PaymentService.CALLBACK_LOG_MAX_LEN)}...<truncated>`
        : serialized
    } catch (err) {
      return `[unserializable:${(err as Error).message}]`
    }
  }

  private getProvider(channel: string): IPaymentProvider {
    const provider = this.providers.get(channel.toUpperCase())
    if (!provider) {
      this.badRequest(`Payment channel '${channel}' is not supported.`, { channel })
    }
    return provider
  }

  private async getActiveChannel(): Promise<PaymentChannel> {
    // 简化策略：优先 WGQPAY，其次 MOCK。若配置了 payment.channels.active 则取第一个。
    try {
      // 为避免循环依赖，将 resolver 延迟获取（通过模块注入）
      const anyThis = this as any
      const resolver: PaymentSettingsResolver | undefined =
        anyThis.resolver || anyThis.paymentSettingsResolver
      if (resolver && typeof resolver.getActiveChannel === 'function') {
        return await resolver.getActiveChannel()
      }
    } catch { }
    return this.wgqpayProvider ? PaymentChannel.WGQPAY : PaymentChannel.MOCK
  }

  private async processSuccessfulPayment(order: PaymentOrder): Promise<void> {
    // 外部商户订单走专用处理路径（不做内部入账，仅触发回调）
    if (order.sourceType === 'EXTERNAL') {
      await this.processExternalPaymentSuccess(order)
      return
    }

    if (!order.targetAssetTypeId || !order.targetAssetAmount) {
      this.logger.error(`Order ${order.id} completed but missing target asset info.`)
      throw new DomainException(`Missing target asset info for completed order ${order.id}`, {
        code: ErrorCode.PAYMENT_ORDER_ASSET_INFO_MISSING,
        args: { orderId: order.id },
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }

    // 提前解析套餐信息，供后续事务与事件复用
    const paymentDetails = order.paymentDetails as PaymentDetailsStructure | null
    const packageInfo = paymentDetails?.package
    const validPackage =
      packageInfo && this.validateRechargePackage(packageInfo) ? packageInfo : null

    let wallet: WalletDetailResponseDto | null = null

    await this.prisma.runInTransaction(async () => {
      // 1. Get the user's wallet
      wallet = await this.walletService.getWalletByUserId(order.userId)
      if (!wallet) {
        this.notFound(`Wallet not found for user ${order.userId}`, { userId: order.userId })
      }

      // 2. Call deposit with string amount to avoid precision loss（避免 toNumber() 精度丢失）
      await this.walletService.deposit(
        wallet!.id,
        order.targetAssetTypeId!,
        order.targetAssetAmount.toString(), // ✅ 传字符串避免精度风险
        true,
        `Deposit from ${order.channel} payment ${order.id}`,
        { relatedEntityType: 'PaymentOrder', relatedEntityId: order.id },
        order.id,
      )
      this.logger.log(`Successfully processed deposit for order ${order.id}`)

      // 3. 检查是否为游客,标记需要绑定（使用 findFirst 以支持软删除过滤）
      const user = await this.prisma.getClient().user.findFirst({
        where: {
          id: order.userId,
          deletedAt: null, // 过滤已软删除的用户
        },
        select: { id: true, isGuest: true, guestRequiresBinding: true },
      })

      if (user?.isGuest && !user.guestRequiresBinding) {
        await this.prisma.getClient().user.update({
          where: { id: user.id },
          data: { guestRequiresBinding: true },
        })

        this.logger.log(
          `游客充值成功,已标记需要绑定 - 用户: ${user.id}, 金额: ${order.amount.toString()}`,
        )
      }

      // 4. 若为会员套餐，则开通/续期会员
      await this.grantMembershipIfNeeded(order.userId, order.id, validPackage)
    })

    if (!wallet) {
      // 理论上不会发生，若发生说明事务中断
      this.notFound(`Wallet not found for user ${order.userId}`, { userId: order.userId })
    }

    // 5. Publish DEPOSIT_COMPLETED event for commission calculation (after commit)
    // 💡 MessageBus 默认配置：attempts=3（重试 3 次）+ exponential backoff（指数退避）
    const depositEventPayload: DepositCompletedEventDto = {
      userId: order.userId,
      walletId: wallet.id,
      amount: order.targetAssetAmount.toString(),
      currency: order.currency,
      assetTypeId: order.targetAssetTypeId,
      orderId: order.id,
      timestamp: new Date().toISOString(),
    }

    this.txEvents.afterCommit(async () => {
      try {
        await this.bus.publish(
          TOPIC_PAYMENT_EVENTS,
          PAYMENT_EVENT.DEPOSIT_COMPLETED,
          depositEventPayload,
          {
            correlationId: order.id,
            dedupeKey: `deposit:${order.id}`, // 发布端去重
          },
        )
        this.logger.debug(
          `Published deposit completed event for order ${order.id} to trigger commission calculation`,
        )
      } catch (err) {
        this.logger.warn(
          `Failed to publish deposit completed event for order ${order.id}: ${(err as Error).message}`,
        )
      }
    })

    const baseAmount = validPackage?.baseScore
      ? new Decimal(validPackage.baseScore).toFixed(6)
      : order.targetAssetAmount.toFixed(6)
    const bonusAmount = validPackage?.bonusScore
      ? new Decimal(validPackage.bonusScore).toFixed(6)
      : '0'
    const bonusPercent = validPackage?.bonusPercent || 0
    const priceAmount = validPackage?.priceAmount || '0'
    const priceCurrency = validPackage?.priceCurrency || 'USD'
    const packageLabel = validPackage?.badgeLabel || validPackage?.displayTitle || 'unknown'

    const payload = {
      userId: order.userId,
      amount: order.targetAssetAmount.toString(), // 完整入账金额
      baseAmount, // ✅ 基础积分
      bonusAmount, // ✅ 赠送积分
      bonusPercent, // ✅ 赠送百分比
      priceAmount, // ✅ 套餐价格
      priceCurrency, // ✅ 套餐币种
      packageLabel, // ✅ 套餐标签
      assetTypeId: order.targetAssetTypeId,
      channel: order.channel,
      sourceId: order.id,
      timestamp: new Date().toISOString(),
      units: 1,
    }

    this.logger.log(
      `Publishing recharge completed event: orderId=${order.id}, totalAmount=${payload.amount}, ` +
      `baseAmount=${baseAmount}, bonusAmount=${bonusAmount}, price=${priceAmount} ${priceCurrency}, package=${packageLabel}`,
    )

    this.txEvents.afterCommit(async () => {
      try {
        await this.bus.publish(
          TOPIC_ENGAGEMENT_EVENTS,
          ENGAGEMENT_EVENT.RECHARGE_COMPLETED,
          payload,
          {
            correlationId: order.id,
            dedupeKey: `recharge:${order.id}`,
          },
        )
        this.logger.debug(
          `Published engagement event '${ENGAGEMENT_EVENT.RECHARGE_COMPLETED}' for order ${order.id}`,
        )
      } catch (err) {
        this.logger.warn(
          `Failed to publish engagement event '${ENGAGEMENT_EVENT.RECHARGE_COMPLETED}' for order ${order.id}: ${(err as Error).message}`,
        )
      }
    })
  }

  // 运行时不再解析前端源码，后续若页面调整，请同步更新上方 RECHARGE_PACKAGES。

  private hasAtMostTwoDecimals(val: unknown): boolean {
    const s = String(val)
    // 仅允许正数，最多两位小数
    const m = s.match(/^\d+(?:\.(\d{1,2}))?$/)
    if (!m) return false
    const frac = m[1]
    return !frac || frac.length <= 2
  }

  private parseAmountDecimal(val: unknown): Decimal {
    const s = String(val)
    if (!/^[-+]?\d+(?:\.\d+)?$/.test(s)) {
      this.badRequest('金额格式不合法', { amount: val, reason: 'invalid format' })
    }
    const d = new Decimal(s)
    if (!d.isFinite()) {
      this.badRequest('金额格式不合法', { amount: val, reason: 'non-finite' })
    }
    return d
  }

  private async grantMembershipIfNeeded(
    userId: string,
    orderId: string,
    pkg: RechargePackageDetails | null,
  ): Promise<void> {
    if (!pkg?.metadata) return
    const meta = pkg.metadata as MembershipMetadata
    const metaType = String(meta.type || '').toUpperCase()
    const rawTier = String(meta.membershipTier || '').toUpperCase()
    const durationDays = Number(meta.durationDays || 0)

    if (metaType !== 'MEMBERSHIP' || durationDays <= 0) return
    if (rawTier !== 'SMALL' && rawTier !== 'BIG') return

    const now = new Date()
    const client = this.prisma.getClient()

    const existing = await client.userMembership.findFirst({
      where: {
        userId,
        endAt: { gt: now },
      },
      orderBy: { endAt: 'desc' },
    })

    const startAt = existing && existing.endAt > now ? existing.endAt : now
    const endAt = new Date(startAt.getTime() + durationDays * 24 * 60 * 60 * 1000)

    await client.userMembership.create({
      data: {
        userId,
        tier: rawTier === 'BIG' ? 'BIG' : 'SMALL',
        startAt,
        endAt,
        sourceOrderId: orderId,
      },
    })

    this.logger.log(
      `Membership updated for user=${userId}, tier=${rawTier}, startAt=${startAt.toISOString()}, endAt=${endAt.toISOString()}, orderId=${orderId}`,
    )
  }

  /**
   * 处理外部商户订单支付成功
   *
   * @description
   * 外部商户订单不做内部入账（无内部用户），仅发布事件触发商户回调。
   * 商户收到回调后在其系统中完成用户权益发放。
   */
  private async processExternalPaymentSuccess(order: PaymentOrder): Promise<void> {
    this.logger.log(
      `Processing external payment success: orderId=${order.id}, merchantId=${order.merchantId}`,
    )

    // 外部订单不需要内部入账，直接发布事件触发回调
    const depositEventPayload: DepositCompletedEventDto = {
      userId: '', // 外部订单无内部用户
      walletId: '', // 外部订单无钱包
      amount: order.amount.toString(),
      currency: order.currency,
      assetTypeId: order.targetAssetTypeId || '',
      orderId: order.id,
      timestamp: new Date().toISOString(),
    }

    this.txEvents.afterCommit(async () => {
      try {
        await this.bus.publish(
          TOPIC_PAYMENT_EVENTS,
          PAYMENT_EVENT.DEPOSIT_COMPLETED,
          depositEventPayload,
          {
            correlationId: order.id,
            dedupeKey: `deposit:${order.id}`,
          },
        )
        this.logger.log(
          `Published external payment completed event for order ${order.id} to trigger merchant callback`,
        )
      }
      catch (err) {
        this.logger.warn(
          `Failed to publish external payment completed event for order ${order.id}: ${(err as Error).message}`,
        )
      }
    })
  }
}
