import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PaymentOrder, PaymentOrderSourceType, PaymentOrderStatus } from '@prisma/client'
import { normalizeToFixed } from '@ai/shared'

/**
 * 充值套餐详情
 */
export class RechargePackageDetailsDto {
  @ApiProperty({ description: '套餐标签', example: '进阶套餐' })
  label: string

  @ApiProperty({ description: '套餐价格（美元）', example: '20.00' })
  priceUSD: string

  @ApiProperty({ description: '基础积分', example: 3000 })
  baseScore: number

  @ApiProperty({ description: '赠送百分比', example: 10 })
  bonusPercent: number

  @ApiProperty({ description: '赠送积分', example: 300 })
  bonusScore: number

  @ApiProperty({ description: '总积分（基础+赠送）', example: 3300 })
  totalScore: number
}

/**
 * 回调商品信息 DTO
 *
 * @description
 * 用于外部查询接口返回完整的商品信息，
 * 以便回调失败时能重建 PaymentCenterCallbackDto
 * 结构与回调通知中的 productInfo 保持一致
 */
export class CallbackProductInfoDto {
  @ApiProperty({ description: '套餐 ID', example: 'pkg_starter' })
  id: string

  @ApiProperty({ description: '套餐名称（内部标识）', example: 'starter' })
  name: string

  @ApiProperty({ description: '展示标题', example: '入门套餐' })
  displayTitle: string

  @ApiPropertyOptional({ description: '徽章标签（如"热门"）', example: '热门' })
  badgeLabel?: string

  @ApiProperty({ description: '套餐价格（美元）', example: '10.00' })
  priceAmount: string

  @ApiProperty({ description: '套餐币种', example: 'USD' })
  priceCurrency: string

  @ApiProperty({ description: '基础积分', example: 1000 })
  baseScore: number

  @ApiProperty({ description: '赠送积分', example: 50 })
  bonusScore: number

  @ApiProperty({ description: '总积分', example: 1050 })
  totalScore: number
}

/**
 * 支付订单详情结构
 */
export class PaymentDetailsDto {
  @ApiPropertyOptional({ description: '请求的支付方式', example: 'WGQPAY' })
  requestedMethod?: string

  @ApiPropertyOptional({
    description: '请求的金额和币种',
    example: { amount: '20', currency: 'USD' },
  })
  requested?: {
    amount: string
    currency: string
  }

  @ApiPropertyOptional({
    description: '结算金额和币种',
    example: { amount: '20.00', currency: 'USD', rate: '1.0' },
  })
  settled?: {
    amount: string
    currency: string
    rate?: string
  }

  @ApiPropertyOptional({
    description: '充值套餐详情（仅充值订单包含）',
    type: RechargePackageDetailsDto,
  })
  package?: RechargePackageDetailsDto;

  [key: string]: unknown
}

export class PaymentOrderResponseDto {
  @ApiProperty({ description: 'Order ID', example: 'AbCd23' })
  id: string

  @ApiPropertyOptional({ description: 'User ID (null for external merchant orders)', example: 'XyZ789', type: String })
  userId: string | null

  @ApiProperty({ description: 'Payment amount (string)', example: '100.500000', type: String })
  amount: string

  @ApiProperty({ description: 'Payment currency', example: 'USD' })
  currency: string

  @ApiProperty({ description: 'Payment channel', example: 'STRIPE' })
  channel: string

  @ApiPropertyOptional({ description: 'Target asset ID', example: 'QwErTy', type: String })
  targetAssetTypeId?: string | null

  @ApiPropertyOptional({
    description: 'Target asset amount (string)',
    example: '10.000000',
    type: String,
  })
  targetAssetAmount?: string | null

  @ApiPropertyOptional({ description: 'Exchange rate', example: 0.1, type: Number })
  exchangeRate?: number | null

  @ApiProperty({
    description: 'Order status',
    enum: PaymentOrderStatus,
    example: PaymentOrderStatus.PENDING,
  })
  status: PaymentOrderStatus

  @ApiPropertyOptional({
    description: 'External order ID from payment provider',
    example: 'pi_...',
    type: String,
  })
  externalOrderId?: string | null

  @ApiPropertyOptional({
    description: 'Payment details (including package info for recharge orders)',
    type: PaymentDetailsDto,
  })
  paymentDetails?: PaymentDetailsDto

  @ApiPropertyOptional({ description: 'Order expiration timestamp', type: Date })
  expiresAt?: Date | null

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date

  @ApiPropertyOptional({ description: 'Completion timestamp', type: Date })
  completedAt?: Date | null

  @ApiPropertyOptional({ description: '外部商户返回地址（支付成功后跳转）', type: String })
  returnUrl?: string | null

  @ApiProperty({
    description: '订单来源类型',
    enum: PaymentOrderSourceType,
    example: PaymentOrderSourceType.INTERNAL,
  })
  sourceType: PaymentOrderSourceType

  @ApiPropertyOptional({ description: '外部商户 ID', type: String })
  merchantId?: string | null

  @ApiPropertyOptional({ description: '外部商户业务订单号', type: String })
  businessOrderId?: string | null

  @ApiPropertyOptional({ description: '商户回调 URL', type: String })
  callbackUrl?: string | null

  @ApiPropertyOptional({ description: '回调状态', type: String })
  callbackStatus?: string | null

  @ApiPropertyOptional({ description: '回调尝试次数', type: Number })
  callbackAttempts?: number | null

  constructor(order: PaymentOrder) {
    this.id = order.id
    this.userId = order.userId ?? null
    this.amount = normalizeToFixed(order.amount.toString(), 6)
    this.currency = order.currency
    this.channel = order.channel
    this.targetAssetTypeId = order.targetAssetTypeId
    this.targetAssetAmount = order.targetAssetAmount
      ? normalizeToFixed(order.targetAssetAmount.toString(), 6)
      : null
    this.exchangeRate = order.exchangeRate?.toNumber() ?? null
    this.status = order.status
    this.externalOrderId = order.externalOrderId
    this.paymentDetails = order.paymentDetails as PaymentDetailsDto | undefined
    this.expiresAt = order.expiresAt
    this.createdAt = order.createdAt
    this.completedAt = order.completedAt
    this.returnUrl = order.returnUrl
    this.sourceType = order.sourceType
    this.merchantId = order.merchantId
    this.businessOrderId = order.businessOrderId
    this.callbackUrl = order.callbackUrl

    // 回调状态和尝试次数存储在 paymentDetails.merchantContext 中
    const details = order.paymentDetails as Record<string, unknown> | null
    const merchantContext = details?.merchantContext as Record<string, unknown> | null
    this.callbackStatus = (merchantContext?.callbackStatus as string) ?? null
    this.callbackAttempts = (merchantContext?.callbackAttempts as number) ?? null
  }
}

/**
 * 外部订单公开查询响应 DTO（精简版）
 *
 * @description
 * 用于外部商户前端轮询订单状态的公开接口
 * - 仅包含订单状态、金额、支付链接等必要信息
 * - 不返回敏感的商户信息（callbackUrl、merchantContext 等）
 * - 包含完整的 productInfo 用于回调失败时重建 PaymentCenterCallbackDto
 * - 符合"所有接口需鉴权 / 输出脱敏"的安全约束
 */
export class ExternalOrderPublicResponseDto {
  @ApiProperty({ description: '订单 ID', example: 'AbCd23' })
  id: string

  @ApiProperty({ description: '支付金额', example: '100.00', type: String })
  amount: string

  @ApiProperty({ description: '支付币种', example: 'USD' })
  currency: string

  @ApiProperty({ description: '支付渠道', example: 'WGQPAY' })
  channel: string

  @ApiProperty({
    description: '订单状态',
    enum: PaymentOrderStatus,
    example: PaymentOrderStatus.PENDING,
  })
  status: PaymentOrderStatus

  @ApiPropertyOptional({ description: '支付链接（用于跳转支付）', type: String })
  payUrl?: string | null

  @ApiPropertyOptional({ description: '商户返回地址（支付成功后跳转）', type: String })
  returnUrl?: string | null

  @ApiPropertyOptional({ description: '商户业务订单号', type: String })
  businessOrderId?: string | null

  @ApiPropertyOptional({
    description: '商品信息（用于回调失败时重建 PaymentCenterCallbackDto）',
    type: CallbackProductInfoDto,
  })
  productInfo?: CallbackProductInfoDto | null

  @ApiProperty({ description: '创建时间' })
  createdAt: Date

  @ApiPropertyOptional({ description: '完成时间', type: Date })
  completedAt?: Date | null

  @ApiPropertyOptional({ description: '过期时间', type: Date })
  expiresAt?: Date | null

  constructor(order: PaymentOrder) {
    this.id = order.id
    this.channel = order.channel
    this.status = order.status
    this.returnUrl = order.returnUrl
    this.businessOrderId = order.businessOrderId
    this.createdAt = order.createdAt
    this.completedAt = order.completedAt
    this.expiresAt = order.expiresAt

    // 从 paymentDetails 中提取信息
    const details = order.paymentDetails as Record<string, unknown> | null

    // 优先使用商户上下文中的金额（USD），用于签名验证和回调重建
    // merchantContext.amount 是商户期望的 USD 金额，而 order.amount 可能是网关结算后的 CNY 金额
    const merchantContext = details?.merchantContext as { amount?: string } | undefined
    if (merchantContext?.amount) {
      this.amount = normalizeToFixed(merchantContext.amount, 6)
      this.currency = 'USD' // 商户签名时的币种固定为 USD
    }
    else {
      // 回退到订单金额（兼容旧数据）
      this.amount = normalizeToFixed(order.amount.toString(), 6)
      this.currency = order.currency
    }

    // 提取支付链接（脱敏：不返回 merchantContext 其他字段）
    this.payUrl = (details?.pay_url as string)
      || (details?.url as string)
      || (details?.mockPaymentUrl as string)
      || null

    // 提取完整的商品信息用于回调重建
    const packageInfo = details?.package as Record<string, unknown> | null
    if (packageInfo) {
      this.productInfo = {
        id: String(packageInfo.id || ''),
        name: String(packageInfo.name || ''),
        displayTitle: String(packageInfo.displayTitle || ''),
        badgeLabel: packageInfo.badgeLabel ? String(packageInfo.badgeLabel) : undefined,
        priceAmount: String(packageInfo.priceAmount || ''),
        priceCurrency: String(packageInfo.priceCurrency || 'USD'),
        baseScore: Number(packageInfo.baseScore || 0),
        bonusScore: Number(packageInfo.bonusScore || 0),
        totalScore: Number(packageInfo.totalScore || 0),
      }
    }
    else {
      this.productInfo = null
    }
  }
}
