import { Injectable, Logger } from '@nestjs/common'
import { SignatureUtil } from '../utils/signature.util'
import { PaymentMerchantService } from './payment-merchant.service'
import {
  ExternalPaymentInvalidSignatureException,
  ExternalPaymentTimestampExpiredException,
} from '../exceptions'
import { CreateExternalPaymentOrderDto } from '../dto/requests/create-external-payment-order.dto'
import { QueryExternalOrderStatusDto } from '../dto/requests/query-external-order-status.dto'

/**
 * 回调通知状态
 */
export type CallbackStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

/**
 * 外部商户追踪基础信息（验证阶段返回）
 */
export interface ExternalMerchantContextBase {
  merchantId: string
  businessOrderId: string
  extraData?: string
  retUrl: string
  callbackUrl: string
}

/**
 * 外部商户追踪信息（存储在 paymentDetails.merchantContext）
 * 包含回调所需的完整字段，在创建订单时补充
 */
export interface ExternalMerchantContext extends ExternalMerchantContextBase {
  /** 商户期望的支付金额（USD，用于回调签名） */
  amount: string
  /** 回调状态 */
  callbackStatus: CallbackStatus
  /** 回调尝试次数 */
  callbackAttempts: number
  /** 最后一次回调时间 */
  lastCallbackAt?: string
  /** 最后一次回调错误信息 */
  lastCallbackError?: string
}

/**
 * 签名参数（用于审计，存储在 signatureData 字段）
 *
 * @description
 * 仅包含商户签名的参数，不包含 amount（金额从套餐获取，防止篡改）
 */
export interface ExternalSignatureData {
  merchantId: string
  businessOrderId: string
  retUrl: string
  extraData?: string
  timestamp: number
  /** 签名前缀（脱敏，仅记录前 8 位） */
  signPrefix: string
}

/**
 * 外部支付服务
 *
 * @description
 * 处理外部商户支付的签名验证
 * - 验证 HMAC-SHA256 签名
 * - 验证时间戳防重放（± 5 分钟）
 * - 获取商户配置
 *
 * 新流程：
 * 1. 商户跳转到 /recharge?merchant_id=xxx&... 页面
 * 2. 用户选择商品后点击购买
 * 3. 前端调用创建订单 API，后端验证签名
 * 4. 创建订单并发起支付
 */
@Injectable()
export class PaymentExternalService {
  private readonly logger = new Logger(PaymentExternalService.name)

  constructor(
    private readonly signatureUtil: SignatureUtil,
    private readonly merchantService: PaymentMerchantService,
  ) {}

  /**
   * 验证外部支付请求
   *
   * @param dto - 外部支付请求参数（含签名）
   * @returns 商户回调地址
   * @throws ExternalPaymentInvalidSignatureException 签名验证失败
   * @throws ExternalPaymentTimestampExpiredException 时间戳过期
   * @throws ExternalPaymentMerchantNotFoundException 商户不存在
   * @throws ExternalPaymentMerchantDisabledException 商户已禁用
   */
  async validateExternalRequest(dto: CreateExternalPaymentOrderDto): Promise<{
    callbackUrl: string
    merchantContext: ExternalMerchantContextBase
    signatureData: ExternalSignatureData
  }> {
    // 1. 获取商户配置（会检查商户是否存在和启用状态）
    const merchantConfig = await this.merchantService.getMerchantConfig(dto.merchantId)

    // 2. 验证时间戳（± 5 分钟，注意 timestamp 是秒）
    this.verifyTimestamp(dto.timestamp, dto.merchantId)

    // 3. 验证签名
    await this.verifySignature(dto, merchantConfig.secret_key)

    // 4. 构建商户上下文（基础信息，完整字段在创建订单时补充）
    const merchantContext: ExternalMerchantContextBase = {
      merchantId: dto.merchantId,
      businessOrderId: dto.businessOrderId,
      extraData: dto.extraData,
      retUrl: dto.retUrl,
      callbackUrl: merchantConfig.callback_url,
    }

    // 5. 构建签名审计数据（脱敏）
    const signatureData: ExternalSignatureData = {
      merchantId: dto.merchantId,
      businessOrderId: dto.businessOrderId,
      retUrl: dto.retUrl,
      extraData: dto.extraData,
      timestamp: dto.timestamp,
      signPrefix: dto.sign.substring(0, 8),
    }

    this.logger.log(
      `外部支付请求验证通过: merchantId=${dto.merchantId}, businessOrderId=${dto.businessOrderId}`,
    )

    return {
      callbackUrl: merchantConfig.callback_url,
      merchantContext,
      signatureData,
    }
  }

  /**
   * 验证签名
   *
   * @description
   * 签名算法：HMAC-SHA256
   * 签名内容：按 key 字典序排列（不包含 sign 自身）
   * business_order_id=xxx&extra_data=xxx&merchant_id=xxx&ret_url=xxx&timestamp=xxx
   */
  private async verifySignature(
    dto: CreateExternalPaymentOrderDto,
    secretKey: string,
  ): Promise<void> {
    // 构建签名参数（按 PRD 要求的字段）
    const signParams: Record<string, string | number | undefined> = {
      business_order_id: dto.businessOrderId,
      extra_data: dto.extraData,
      merchant_id: dto.merchantId,
      ret_url: dto.retUrl,
      timestamp: dto.timestamp,
    }

    // 移除 undefined 值
    const filteredParams = Object.fromEntries(
      Object.entries(signParams).filter(([, v]) => v !== undefined),
    ) as Record<string, string | number>

    const isValid = this.signatureUtil.verify(
      { ...filteredParams, sign: dto.sign },
      secretKey,
    )

    if (!isValid) {
      this.logger.warn(
        `外部支付签名验证失败: merchantId=${dto.merchantId}, businessOrderId=${dto.businessOrderId}`,
      )
      throw new ExternalPaymentInvalidSignatureException(dto.merchantId)
    }
  }

  /**
   * 验证时间戳
   *
   * @description
   * 时间戳为秒级，允许 ± 5 分钟误差
   */
  private verifyTimestamp(timestampSec: number, merchantId: string): void {
    // 转换为毫秒进行比较
    const timestampMs = timestampSec * 1000
    const isValid = this.signatureUtil.verifyTimestamp(timestampMs)

    if (!isValid) {
      const serverTime = Date.now()
      this.logger.warn(
        `外部支付时间戳过期: merchantId=${merchantId}, timestamp=${timestampSec}, serverTime=${Math.floor(serverTime / 1000)}`,
      )
      throw new ExternalPaymentTimestampExpiredException({
        timestamp: timestampSec,
        serverTime: Math.floor(serverTime / 1000),
      })
    }
  }

  /**
   * 验证订单状态查询请求
   *
   * @param dto - 查询请求参数（含签名）
   * @throws ExternalPaymentInvalidSignatureException 签名验证失败
   * @throws ExternalPaymentTimestampExpiredException 时间戳过期
   * @throws ExternalPaymentMerchantNotFoundException 商户不存在
   * @throws ExternalPaymentMerchantDisabledException 商户已禁用
   */
  async validateQueryRequest(dto: QueryExternalOrderStatusDto): Promise<void> {
    // 1. 获取商户配置
    const merchantConfig = await this.merchantService.getMerchantConfig(dto.merchantId)

    // 2. 验证时间戳
    this.verifyTimestamp(dto.timestamp, dto.merchantId)

    // 3. 验证签名
    const signParams: Record<string, string | number> = {
      business_order_id: dto.businessOrderId,
      merchant_id: dto.merchantId,
      timestamp: dto.timestamp,
    }

    const isValid = this.signatureUtil.verify(
      { ...signParams, sign: dto.sign },
      merchantConfig.secret_key,
    )

    if (!isValid) {
      this.logger.warn(
        `外部订单查询签名验证失败: merchantId=${dto.merchantId}, businessOrderId=${dto.businessOrderId}`,
      )
      throw new ExternalPaymentInvalidSignatureException(dto.merchantId)
    }

    this.logger.log(
      `外部订单查询请求验证通过: merchantId=${dto.merchantId}, businessOrderId=${dto.businessOrderId}`,
    )
  }
}
