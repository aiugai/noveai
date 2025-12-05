import { HttpStatus, Injectable, Logger } from '@nestjs/common'
import { IPaymentProvider, IPaymentResult } from '../interfaces/payment.provider.interface'
import type { PaymentOrder } from '@prisma/client'
import * as crypto from 'node:crypto'
import { PaymentChannel } from '../enums/payment.channel.enum'
import { HttpClientService } from '@/common/http/http-client.service'
import { CacheService } from '@/cache/cache.service'
import { PaymentSettingsResolver } from '../services/payment.settings.resolver'
import { DomainException } from '@/common/exceptions/domain.exception'
import { ErrorCode } from '@ai/shared'

type WGQState = 0 | 1 | 2

interface WGQCommonResp {
  code: number
  message: string
}

interface WGQPayRequestBody {
  merchant_no: string
  merchant_order_id: string
  pay_type: string
  amount: number
  caller_ip: string
  trade_name: string
  timestamp: string
  attach?: string
  extra_info?: string
  notify_url: string
  return_url: string
  sign: string
}

interface WGQPayResponseBody extends WGQCommonResp {
  data?: {
    merchant_no: string
    merchant_order_id: string
    timestamp: string
    state: WGQState
    remark: string
    pay_url?: string
    sign: string
  }
}

interface WGQCallbackBody {
  merchant_no: string
  merchant_order_id: string
  platform_order_id: string
  timestamp: string
  attach?: string
  state: WGQState
  amount: number
  pay_amount: number
  code: number
  message: string
  sign: string
}

@Injectable()
export class WGQPayProvider implements IPaymentProvider {
  readonly channel = PaymentChannel.WGQPAY
  private readonly logger = new Logger(WGQPayProvider.name)

  // 统一签名：按照 ASCII 字典序拼接非空字段，扩展字段自动参与
  private buildSignature(params: Record<string, unknown>, secret: string): string {
    const kvPairs = Object.keys(params)
      .filter(key => key !== 'sign')
      .filter(key => {
        const val = (params as any)[key]
        if (val === undefined || val === null) return false
        if (typeof val === 'string' && val.trim() === '') return false
        return true
      })
      .sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))
      .map(key => {
        const value = (params as any)[key]
        const normalized = this.normalizeValue(value)
        return `${key}=${normalized}`
      })

    const base = `${kvPairs.join('&')}&key=${secret}`
    return crypto.createHash('md5').update(base).digest('hex')
  }

  private normalizeValue(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value)
      } catch {
        return ''
      }
    }
    return String(value)
  }

  constructor(
    private readonly http: HttpClientService,
    private readonly cache: CacheService,
    private readonly resolver: PaymentSettingsResolver,
  ) {}

  private async getCfg() {
    const cfg = await this.resolver.getWgqpayConfig()
    return {
      host: cfg.host,
      merchant: cfg.merchantNo,
      secret: cfg.secret,
      payType: cfg.payType,
      notifyUrl: cfg.notifyUrl,
      returnUrl: cfg.returnUrl,
      requestTimeoutMs: cfg.requestTimeoutMs,
      userAgent: cfg.userAgent,
      requestMaxRetries: cfg.requestMaxRetries,
      requestRetryBaseMs: cfg.requestRetryBaseMs,
      callerIp: cfg.callerIp,
      tradeName: cfg.tradeName,
      callbackMaxSkewSec: cfg.callbackMaxSkewSec,
      callbackNonceTtlSec: cfg.callbackNonceTtlSec,
      requestContentType: cfg.requestContentType,
    }
  }

  private async postJson<T>(url: string, body: any): Promise<T> {
    const cfg = await this.resolver.getWgqpayConfig()
    const timeoutMs = cfg.requestTimeoutMs
    const ua = cfg.userAgent
    const maxRetries = cfg.requestMaxRetries
    const baseDelayMs = cfg.requestRetryBaseMs
    const started = Date.now()
    const resp = await this.http.postJson<T>(url, body, {
      timeoutMs,
      headers: { 'User-Agent': ua },
      retry: { maxRetries, baseDelayMs, retryOn: status => status >= 500 },
    })
    const elapsed = Date.now() - started
    this.logger.log(`[WGQPAY] POST ${url} ok in ${elapsed}ms (retries<=${maxRetries})`)
    return resp
  }

  async createPayment(order: PaymentOrder): Promise<IPaymentResult> {
    // 检查模拟支付开关（生产环境强制禁用）
    const mockEnabled = await this.resolver.isWgqpayMockEnabled()
    if (mockEnabled) {
      this.logger.warn(`[WGQPAY] 🚧 模拟下单成功 order=${order.id} (mockEnabled=true，跳过第三方API)`)
      return {
        status: 'COMPLETED',
        externalOrderId: `MOCK_${order.id}_${Date.now()}`,
      }
    }

    const cfg = await this.getCfg()
    const url = `${cfg.host.replace(/\/$/, '')}/order/pay`
    const amount = parseFloat((order.amount as any).toString())
    const payload: Omit<WGQPayRequestBody, 'sign'> & { sign?: string } = {
      merchant_no: cfg.merchant,
      merchant_order_id: order.id,
      pay_type: cfg.payType,
      amount,
      caller_ip: cfg.callerIp,
      trade_name: cfg.tradeName,
      timestamp: Date.now().toString(),
      notify_url: cfg.notifyUrl,
      return_url: cfg.returnUrl,
    }
    payload.sign = this.buildSignature(payload as Record<string, unknown>, cfg.secret)

    this.logger.log(`[WGQPAY] 下单 ${order.id} amount=${amount} pay_type=${cfg.payType}`)
    // 🔍 调试：打印回调地址（脱敏），便于排查回调不通的问题
    this.logger.debug(`[WGQPAY] 回调地址配置 notify_url=${this.maskSensitive(cfg.notifyUrl)}`)
    const contentType = cfg.requestContentType
    this.logger.debug(
      `[WGQPAY] 请求汇总 order=${order.id} ct=${contentType} url=${url} merchant=${this.maskSensitive(cfg.merchant)} trade_name=${cfg.tradeName}`,
    )

    // 详细日志仅在 debug 模式输出
    if (Logger.isLevelEnabled('debug')) {
      this.logger.debug(`[WGQPAY] 请求参数字段明细:`)
      this.logger.debug(`  - merchant_no: ${this.maskSensitive(payload.merchant_no)}`)
      this.logger.debug(`  - merchant_order_id: ${payload.merchant_order_id}`)
      this.logger.debug(`  - pay_type: ${payload.pay_type}`)
      this.logger.debug(`  - amount: ${payload.amount}`)
      this.logger.debug(`  - caller_ip: ${payload.caller_ip}`)
      this.logger.debug(`  - trade_name: ${payload.trade_name}`)
      this.logger.debug(`  - timestamp: ${payload.timestamp}`)
      this.logger.debug(`  - attach: ${payload.attach ?? '(未设置)'}`)
      this.logger.debug(`  - extra_info: ${payload.extra_info ?? '(未设置)'}`)
      this.logger.debug(`  - notify_url: ${this.maskUrl(payload.notify_url)}`)
      this.logger.debug(`  - return_url: ${this.maskUrl(payload.return_url)}`)
      this.logger.debug(`  - sign: ${this.maskSensitive(payload.sign)}`)
    }

    let resp: WGQPayResponseBody
    if (contentType === 'application/x-www-form-urlencoded') {
      const form = new URLSearchParams()
      for (const k of Object.keys(payload)) {
        const v = (payload as any)[k]
        if (v !== undefined && v !== null) form.append(k, String(v))
      }
      const timeoutMs = cfg.requestTimeoutMs
      const ua = cfg.userAgent
      const maxRetries = cfg.requestMaxRetries
      const baseDelayMs = cfg.requestRetryBaseMs
      const started = Date.now()
      resp = await this.http.post<WGQPayResponseBody>(url, form, {
        timeoutMs,
        headers: { 'User-Agent': ua, 'Content-Type': contentType },
        retry: { maxRetries, baseDelayMs, retryOn: status => status >= 500 },
      })
      const elapsed = Date.now() - started
      this.logger.log(
        `[WGQPAY] POST ${url} (form) ok in ${elapsed}ms (retries<=${maxRetries}) order=${order.id}`,
      )
    } else {
      resp = await this.postJson<WGQPayResponseBody>(url, payload)
    }

    // 详细日志仅在 debug 模式输出
    if (Logger.isLevelEnabled('debug')) {
      this.logger.debug(`[WGQPAY] 响应字段明细:`)
      this.logger.debug(`  - code: ${(resp as any)?.code}`)
      this.logger.debug(`  - message: ${(resp as any)?.message}`)
      if (resp.data) {
        this.logger.debug(`  - data 字段存在，内容:`)
        this.logger.debug(`    - merchant_no: ${this.maskSensitive(resp.data.merchant_no)}`)
        this.logger.debug(`    - merchant_order_id: ${resp.data.merchant_order_id}`)
        this.logger.debug(`    - timestamp: ${resp.data.timestamp}`)
        this.logger.debug(`    - state: ${resp.data.state}`)
        this.logger.debug(`    - remark: ${resp.data.remark}`)
        this.logger.debug(
          `    - pay_url: ${resp.data.pay_url ? this.maskUrl(resp.data.pay_url) : '(未返回)'}`,
        )
        this.logger.debug(`    - sign: ${this.maskSensitive(resp.data.sign)}`)
      } else {
        this.logger.debug(`  - data 字段不存在，检查扁平结构`)
      }
    }

    // 兼容不同返回结构：既支持 data 包裹，也支持扁平字段
    const codeNum = Number((resp as any)?.code)
    const ok = codeNum === 200 || codeNum === 0

    let data = resp.data as any
    // 某些对接可能返回扁平字段而非 data 包裹
    if (!data || typeof data !== 'object') {
      const flatCandidates: Record<string, unknown> = resp as any
      const hasOwn = (k: string) => Object.prototype.hasOwnProperty.call(flatCandidates, k)
      const flatHasCore =
        flatCandidates &&
        (hasOwn('state') || hasOwn('pay_url') || hasOwn('payUrl') || hasOwn('url'))
      if (flatHasCore) {
        data = {
          merchant_no: (resp as any).merchant_no,
          merchant_order_id: (resp as any).merchant_order_id,
          timestamp: (resp as any).timestamp,
          state: (resp as any).state,
          remark: (resp as any).remark,
          pay_url: (resp as any).pay_url || (resp as any).payUrl || (resp as any).url,
          sign: (resp as any).sign,
        }
      }
    }

    this.logger.debug(
      `[WGQPAY] 响应汇总 order=${order.id} code=${(resp as any)?.code} message=${(resp as any)?.message} hasData=${!!data} keys=${Object.keys(
        resp as any,
      ).join(
        ',',
      )} dataKeys=${data && typeof data === 'object' ? Object.keys(data).join(',') : ''} state=${data?.state} hasPayUrl=${!!data?.pay_url}`,
    )

    if (!ok || !data) {
      // 打印关键字段便于排障（不打印完整 body）
      this.logger.error(
        `WGQPay 下单失败 code=${(resp as any)?.code} message=${(resp as any)?.message} keys=${Object.keys(
          resp as any,
        ).join(',')}`,
      )
      throw new DomainException(`WGQPay order creation failed code=${resp.code} message=${resp.message}`, {
        code: ErrorCode.PAYMENT_THIRD_PARTY_ERROR,
        args: { provider: 'WGQPay', errorCode: resp.code, errorMessage: resp.message },
        status: HttpStatus.BAD_GATEWAY,
      })
    }

    const state = Number((data as any)?.state ?? (resp as any)?.state) as WGQState
    const pay_url = (data as any)?.pay_url as string | undefined

    if (state === 2) {
      // 失败直接抛错，交由上层标记 FAILED（兼容扁平/包裹两种响应结构，避免空指针）
      const codeStr = String((resp as any)?.code ?? '')
      const messageStr = String((resp as any)?.message ?? '')
      const remarkStr = ((data as any)?.remark ??
        (resp as any)?.remark ??
        messageStr ??
        'unknown') as string
      this.logger.error(
        `[WGQPAY] 下单业务失败 order=${order.id} state=${state} code=${codeStr} message=${messageStr} remark=${remarkStr}`,
      )
      throw new DomainException(`WGQPay order response failed state=${state} code=${codeStr} message=${messageStr}`, {
        code: ErrorCode.PAYMENT_THIRD_PARTY_ERROR,
        args: { provider: 'WGQPay', state, errorCode: codeStr, errorMessage: messageStr, remark: remarkStr },
        status: HttpStatus.BAD_GATEWAY,
      })
    }
    if (state === 1) {
      this.logger.debug(`[WGQPAY] 订单立即完成 order=${order.id}`)
      return { status: 'COMPLETED' }
    }
    // 待处理，返回支付链接供前端跳转/展示
    return {
      status: 'PENDING',
      paymentDetails: pay_url ? { pay_url } : undefined,
    }
  }

  async handleCallback(payload: Record<string, unknown>) {
    const payloadPreview = this.safeStringify(payload)
    const data = this.ensureCallbackShape(payload)
    if (!data) {
      const keys = Object.keys(payload || {}).join(',') || '[empty]'
      this.logger.warn(`[WGQPAY] 回调缺少必要字段 keys=${keys} payload=${payloadPreview}`)
      return null
    }
    const cfg = await this.getCfg()

    this.logger.debug(
      `[WGQPAY] 回调到达 merchant_order_id=${(data as any)?.merchant_order_id} state=${(data as any)?.state} code=${(data as any)?.code} amount=${(data as any)?.amount} pay_amount=${(data as any)?.pay_amount} ts=${(data as any)?.timestamp}`,
    )

    // 验签
    const { sign, ...rest } = data as any
    const expected = this.buildSignature(rest, cfg.secret)
    const expectedHex = String(expected).toLowerCase()
    const gotHex = String(sign || '').toLowerCase()
    let valid = false
    try {
      const exp = Buffer.from(expectedHex, 'hex')
      const got = Buffer.from(gotHex, 'hex')
      valid = exp.length === got.length && crypto.timingSafeEqual(exp, got)
    } catch {
      valid = false
    }
    if (!valid) {
      this.logger.warn(
        `[WGQPAY] 回调验签失败 merchant_order_id=${data?.merchant_order_id} expectedPrefix=${expectedHex.slice(0, 12)} gotPrefix=${gotHex.slice(0, 12)} payload=${payloadPreview}`,
      )
      return null
    }

    // 重放防护：时间窗 + nonce
    const maxSkewSec = cfg.callbackMaxSkewSec
    const nonceTtlSec = cfg.callbackNonceTtlSec
    const ts = Number(data.timestamp)
    if (!Number.isFinite(ts)) {
      this.logger.warn(`[WGQPAY] 非法时间戳: ${data.timestamp} payload=${payloadPreview}`)
      return null
    }
    const now = Date.now()
    const skewMs = Math.abs(now - ts)
    if (skewMs > maxSkewSec * 1000) {
      this.logger.warn(
        `[WGQPAY] 回调时间超出窗口 merchant_order_id=${data?.merchant_order_id} ts=${data.timestamp} skewMs=${skewMs}`,
      )
      return null
    }
    const nonceKey = `pay:cb:wgqpay:nonce:${data.merchant_order_id}:${data.timestamp}:${sign}`
    const nonceOk = await this.cache.setIfNotExists(nonceKey, 1, nonceTtlSec)
    if (!nonceOk) {
      this.logger.warn(
        `[WGQPAY] 回调重放检测命中 merchant_order_id=${data?.merchant_order_id} ts=${data.timestamp}`,
      )
      return null
    }
    this.logger.debug(
      `[WGQPAY] 回调 nonce 设置成功 merchant_order_id=${data?.merchant_order_id} ttl=${nonceTtlSec}s keySuffix=${nonceKey.slice(-32)}`,
    )

    // 商户号校验
    if (!data.merchant_no || data.merchant_no !== cfg.merchant) {
      this.logger.warn(
        `[WGQPAY] 回调商户号不匹配 merchant_order_id=${data?.merchant_order_id} merchant_no=${data?.merchant_no} expected=${cfg.merchant}`,
      )
      return null
    }

    const state = Number(data.state) as WGQState
    const status = state === 1 ? 'COMPLETED' : state === 2 ? 'FAILED' : 'PENDING'

    this.logger.debug(
      `[WGQPAY] 回调验签通过 merchant_order_id=${data.merchant_order_id} platform_order_id=${data.platform_order_id} state=${state} -> status=${status}`,
    )

    // 返回部分字段用于上层更新。用 merchant_order_id 作为我方订单ID，platform_order_id 作为 externalOrderId
    return {
      id: data.merchant_order_id,
      externalOrderId: data.platform_order_id,
      status,
      // 透传金额以便服务层做一致性校验
      amount: data.amount,
      payAmount: data.pay_amount,
      completedAt: status === 'COMPLETED' || status === 'FAILED' ? new Date() : undefined,
    } as Partial<PaymentOrder> & { amount?: number; payAmount?: number }
  }

  private ensureCallbackShape(payload: Record<string, unknown>): WGQCallbackBody | null {
    const requiredKeys: Array<keyof WGQCallbackBody> = [
      'merchant_no',
      'merchant_order_id',
      'platform_order_id',
      'timestamp',
      'state',
      'amount',
      'pay_amount',
      'code',
      'message',
      'sign',
    ]
    for (const key of requiredKeys) {
      if (typeof payload[key] === 'undefined') {
        return null
      }
    }
    return payload as unknown as WGQCallbackBody
  }

  private safeStringify(value: unknown): string {
    try {
      const serialized = JSON.stringify(value)
      if (!serialized) return '[empty]'
      return serialized.length > 1500 ? `${serialized.slice(0, 1500)}...<truncated>` : serialized
    } catch (err) {
      return `[unserializable:${(err as Error).message}]`
    }
  }

  /**
   * 脱敏敏感字符串（显示前 4 位和后 4 位）
   */
  private maskSensitive(value: string | undefined): string {
    if (!value) return '(空)'
    if (value.length <= 8) return '****'
    return `${value.slice(0, 4)}****${value.slice(-4)}`
  }

  /**
   * 脱敏 URL（仅保留 host 和 path，移除查询参数）
   */
  private maskUrl(value: string | undefined): string {
    if (!value) return '(空)'
    try {
      const url = new URL(value)
      return `${url.protocol}//${url.host}${url.pathname}?****`
    } catch {
      return `${value.slice(0, 30)}****`
    }
  }

}
