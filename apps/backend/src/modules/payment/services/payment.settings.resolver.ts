import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'
import { SettingsService } from '@/modules/settings/services/settings.service'
import { PaymentChannel } from '../enums/payment.channel.enum'
import { EnvService } from '@/common/services/env.service'

export interface WgqpayConfig {
  host: string
  merchantNo: string
  secret: string
  payType: string
  notifyUrl: string
  returnUrl: string
  requestTimeoutMs: number
  userAgent: string
  requestMaxRetries: number
  requestRetryBaseMs: number
  callerIp: string
  tradeName: string
  callbackMaxSkewSec: number
  callbackNonceTtlSec: number
  requestContentType: 'application/json' | 'application/x-www-form-urlencoded'
}

@Injectable()
export class PaymentSettingsResolver {
  constructor(
    private readonly settings: SettingsService,
    private readonly env: EnvService,
  ) {}
  private readonly logger = new Logger(PaymentSettingsResolver.name)

  /**
   * 读取启用的支付渠道列表，返回首个作为当前激活通道（仅支持单通道）
   * 默认返回 'WGQPAY'。
   */
  async getActiveChannel(): Promise<PaymentChannel> {
    const appEnv = this.env.getAppEnv()
    if (appEnv === 'test' || appEnv === 'e2e') {
      // 测试/联调环境强制使用 MOCK，避免对外部支付网关的真实网络调用
      return PaymentChannel.MOCK
    }
    const defaults = ['WGQPAY']
    const arr = await this.settings.get<string[]>('payment.channels.active', defaults)
    const raw = Array.isArray(arr) && arr.length > 0 ? String(arr[0]).toUpperCase() : 'WGQPAY'
    if (raw in PaymentChannel) {
      return PaymentChannel[raw as keyof typeof PaymentChannel]
    }
    this.logger.warn(`无效的支付通道配置: '${raw}', 回退到 WGQPAY`)
    return PaymentChannel.WGQPAY
  }

  /**
   * 读取当前启用的支付方式列表（用于对外展示）。
   * 默认返回 ['WECHAT','ALIPAY','CREDIT_CARD']。
   */
  async getActivePaymentMethods(): Promise<string[]> {
    const appEnv = this.env.getAppEnv()
    // 测试/联调环境直接返回默认白名单，避免受缓存影响
    if (appEnv === 'test' || appEnv === 'e2e') {
      return ['WECHAT', 'ALIPAY']
    }
    const defaults = ['WECHAT', 'ALIPAY', 'CREDIT_CARD']
    const methods = await this.settings.get<string[]>('payment.methods.active', defaults)
    if (!Array.isArray(methods) || methods.length === 0) return defaults
    return methods.map(m => String(m).toUpperCase())
  }

  async getWgqpayConfig(): Promise<WgqpayConfig> {
    const cfg = await this.settings.get<WgqpayConfig>('payment.wgqpay')
    if (!cfg) {
      throw new DomainException('Missing configuration: payment.wgqpay', {
        code: ErrorCode.INTERNAL_SERVER_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      })
    }

    const required: Array<keyof WgqpayConfig> = [
      'host',
      'merchantNo',
      'secret',
      'payType',
      'notifyUrl',
      'returnUrl',
      'requestTimeoutMs',
      'userAgent',
      'requestMaxRetries',
      'requestRetryBaseMs',
      'callerIp',
      'tradeName',
      'callbackMaxSkewSec',
      'callbackNonceTtlSec',
      'requestContentType',
    ]
    for (const key of required) {
      if (
        (cfg as any)[key] === undefined ||
        (cfg as any)[key] === null ||
        (cfg as any)[key] === ''
      ) {
        throw new DomainException(`Missing payment configuration: payment.wgqpay.${key}`, {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          args: { key },
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        })
      }
    }

    const allowed: ReadonlyArray<string> = ['application/json', 'application/x-www-form-urlencoded']
    if (!allowed.includes(cfg.requestContentType)) {
      throw new DomainException(
        `Invalid payment.wgqpay.requestContentType: ${cfg.requestContentType}`,
        {
          code: ErrorCode.INTERNAL_SERVER_ERROR,
          args: { contentType: cfg.requestContentType },
          status: HttpStatus.INTERNAL_SERVER_ERROR,
        },
      )
    }

    return cfg
  }

  async getWebhookSecret(channel: string): Promise<string | undefined> {
    const map = await this.settings.get<Record<string, string>>('payment.webhookSecrets', {})
    return map?.[channel.toUpperCase()]
  }

  /**
   * 获取 USD->CNY 的汇率（用于将前端以 USD 下单金额换算成人民币传给网关）。
   * 配置键：payment.exchangeRate.USD_CNY，默认 7.20。
   */
  async getUsdToCnyRate(): Promise<number> {
    const rate = await this.settings.get<number>('payment.exchangeRate.USD_CNY', 7.2)
    const n = Number(rate)
    if (!Number.isFinite(n) || n <= 0) {
      this.logger.warn(
        `非法的 USD->CNY 汇率配置：${rate}，使用默认值 7.2。键：payment.exchangeRate.USD_CNY`,
      )
      return 7.2
    }
    return n
  }

  /**
   * 获取 WGQPAY 模拟支付开关
   *
   * @description
   * 启用后跳过第三方 API 调用，直接返回支付成功。
   * - 生产环境：强制返回 false（即使数据库配置为 true）
   * - 其他环境：读取数据库配置，默认 false
   *
   * 配置键：payment.wgqpay.mockEnabled
   */
  async isWgqpayMockEnabled(): Promise<boolean> {
    const appEnv = this.env.getAppEnv()
    // 生产环境强制禁用模拟
    if (appEnv === 'production') {
      return false
    }
    const enabled = await this.settings.get<boolean>('payment.wgqpay.mockEnabled', false)
    return enabled === true || enabled === 'true' as unknown as boolean
  }
}
