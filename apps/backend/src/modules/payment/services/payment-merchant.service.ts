import { Injectable, Logger } from '@nestjs/common'
import { SettingsService } from '@/modules/settings/services/settings.service'
import {
  ExternalPaymentMerchantNotFoundException,
  ExternalPaymentMerchantDisabledException,
} from '../exceptions'

/**
 * 外部商户配置接口
 *
 * @description
 * 存储在 Setting 表中，key = 'external_payment_merchants'
 */
export interface ExternalMerchantConfig {
  merchant_id: string
  merchant_name: string
  secret_key: string
  callback_url: string
  enabled: boolean
}

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/**
 * 商户配置服务
 *
 * @description
 * 从 SystemSetting 读取商户配置信息
 * - 配置 key: external_payment_merchants
 * - 配置格式: { "merchant_001": { merchant_id, merchant_name, secret_key, callback_url, enabled } }
 * - 内置缓存机制，TTL 5 分钟，减少数据库压力
 *
 * @example
 * const config = await merchantService.getMerchantConfig('merchant_001')
 */
@Injectable()
export class PaymentMerchantService {
  private readonly logger = new Logger(PaymentMerchantService.name)

  /** Setting 表中的配置 key */
  private readonly MERCHANTS_CONFIG_KEY = 'external_payment_merchants'

  /** 缓存 TTL（毫秒）- 5 分钟 */
  private readonly CACHE_TTL_MS = 5 * 60 * 1000

  /** 商户配置缓存 */
  private merchantsCache: CacheEntry<Record<string, ExternalMerchantConfig>> | null = null

  constructor(private readonly settingsService: SettingsService) {}

  /**
   * 获取商户配置
   *
   * @param merchantId - 商户ID (如 merchant_001)
   * @returns 商户配置
   * @throws ExternalPaymentMerchantNotFoundException 当商户未配置时
   * @throws ExternalPaymentMerchantDisabledException 当商户已禁用时
   */
  async getMerchantConfig(merchantId: string): Promise<ExternalMerchantConfig> {
    const merchants = await this.getAllMerchants()

    const config = merchants[merchantId]
    if (!config) {
      this.logger.warn(`外部商户未配置: ${merchantId}`)
      throw new ExternalPaymentMerchantNotFoundException(merchantId)
    }

    if (!config.enabled) {
      this.logger.warn(`外部商户已禁用: ${merchantId}`)
      throw new ExternalPaymentMerchantDisabledException(merchantId)
    }

    return config
  }

  /**
   * 获取商户密钥
   *
   * @param merchantId - 商户ID
   * @returns 商户密钥
   * @throws ExternalPaymentMerchantNotFoundException 当商户未配置时
   * @throws ExternalPaymentMerchantDisabledException 当商户已禁用时
   */
  async getMerchantSecretKey(merchantId: string): Promise<string> {
    const config = await this.getMerchantConfig(merchantId)
    return config.secret_key
  }

  /**
   * 获取商户名称
   *
   * @param merchantId - 商户ID
   * @returns 商户名称
   */
  async getMerchantName(merchantId: string): Promise<string> {
    try {
      const config = await this.getMerchantConfig(merchantId)
      return config.merchant_name || merchantId
    }
    catch {
      return merchantId
    }
  }

  /**
   * 获取商户回调地址
   *
   * @param merchantId - 商户ID
   * @returns 回调地址
   */
  async getMerchantCallbackUrl(merchantId: string): Promise<string> {
    const config = await this.getMerchantConfig(merchantId)
    return config.callback_url
  }

  /**
   * 检查商户是否已配置且启用
   *
   * @param merchantId - 商户ID
   * @returns 是否已配置且启用
   */
  async isMerchantConfigured(merchantId: string): Promise<boolean> {
    try {
      await this.getMerchantConfig(merchantId)
      return true
    }
    catch {
      return false
    }
  }

  /**
   * 获取所有商户配置（带缓存）
   *
   * @description
   * 使用内存缓存减少数据库查询
   * - 缓存 TTL：5 分钟
   * - 缓存命中时直接返回
   * - 缓存过期或不存在时从数据库读取并更新缓存
   */
  private async getAllMerchants(): Promise<Record<string, ExternalMerchantConfig>> {
    const now = Date.now()

    // 检查缓存是否有效
    if (this.merchantsCache && this.merchantsCache.expiresAt > now) {
      return this.merchantsCache.data
    }

    // 缓存过期或不存在，从数据库读取
    const merchants = await this.settingsService.getJson<Record<string, ExternalMerchantConfig>>(
      this.MERCHANTS_CONFIG_KEY,
    )
    const data = merchants || {}

    // 更新缓存
    this.merchantsCache = {
      data,
      expiresAt: now + this.CACHE_TTL_MS,
    }

    this.logger.debug(`商户配置缓存已更新，共 ${Object.keys(data).length} 个商户`)

    return data
  }

  /**
   * 清除商户配置缓存
   *
   * @description
   * 当商户配置变更时调用，强制下次请求重新从数据库读取
   */
  clearCache(): void {
    this.merchantsCache = null
    this.logger.debug('商户配置缓存已清除')
  }
}
