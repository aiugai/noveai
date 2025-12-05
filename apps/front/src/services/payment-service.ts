'use client'

import { createApiClient, schemas } from '@ai/api-contracts'
import type { z } from 'zod'
import { isAxiosError } from 'axios'

import { getToken } from '@/lib/auth-storage'

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3005/api/v1'

const client = createApiClient(API_BASE_URL, { validate: 'request' })

export type PaymentOptionsResponse = z.infer<typeof schemas.PaymentOptionsResponseDto>
export type PaymentOrderResponse = z.infer<typeof schemas.PaymentOrderResponseDto>
export type CreatePaymentOrderRequest = z.infer<typeof schemas.CreatePaymentOrderRequestDto>
export type CreateExternalPaymentOrderRequest = z.infer<
  typeof schemas.CreateExternalPaymentOrderDto
>
export type ExternalOrderStatusResponse = z.infer<typeof schemas.ExternalOrderStatusResponseDto>
export type ExternalOrderPublicResponse = z.infer<typeof schemas.ExternalOrderPublicResponseDto>
export type CallbackProductInfo = z.infer<typeof schemas.CallbackProductInfoDto>
export type PaymentMethod = z.infer<typeof schemas.PaymentMethod>
export type RechargePackageOption = z.infer<typeof schemas.RechargePackageOptionDto>

interface PaymentDetails {
  pay_url?: string
  url?: string
  mockPaymentUrl?: string
  [key: string]: unknown
}

function requireAuthHeaders() {
  const token = getToken()
  if (!token) throw new Error('登录状态已失效，请重新登录')
  return { Authorization: `Bearer ${token}` }
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === 'string' && input.length > 0
}

/**
 * 验证 URL 协议是否为 http 或 https
 * 用于防止 javascript:/data: 等伪协议注入
 */
export function ensureHttpUrl(maybeUrl?: string | null): string | undefined {
  if (!isNonEmptyString(maybeUrl)) return undefined
  try {
    const u = new URL(maybeUrl)
    return u.protocol === 'http:' || u.protocol === 'https:' ? maybeUrl : undefined
  } catch {
    return undefined
  }
}

function readPaymentDetailsField(order: unknown): unknown {
  if (!order || typeof order !== 'object') return undefined
  if (!Object.prototype.hasOwnProperty.call(order, 'paymentDetails')) return undefined
  const record = order as Record<string, unknown>
  return record.paymentDetails
}

export function extractRedirectUrl(details: unknown): string | undefined {
  if (!details || typeof details !== 'object') return undefined
  const obj = details as PaymentDetails
  return ensureHttpUrl(obj.pay_url) || ensureHttpUrl(obj.url) || ensureHttpUrl(obj.mockPaymentUrl)
}

function getUserFriendlyMessage(error: unknown): string {
  const maybeAxios = error as Partial<ReturnType<typeof isAxiosError>>
  const status = (maybeAxios as { response?: { status?: number } })?.response?.status
  const code = (maybeAxios as { code?: string })?.code
  const rawMessage = (maybeAxios as { message?: string })?.message

  const isNetworkError =
    code === 'ERR_NETWORK' || code === 'ECONNABORTED' || rawMessage === 'Network Error'
  if (isNetworkError) return '网络异常，请检查网络后重试'

  if (status === 401) return '登录已过期，请重新登录后再试'
  if (status === 429) return '请求过于频繁，请稍后再试'
  if (status && status >= 500) return '服务暂不可用，请稍后重试'
  if (status === 400) return '下单失败，请检查参数或稍后重试'

  return '下单失败，请稍后重试'
}

export const PaymentService = {
  /**
   * 获取支付选项（需要登录）
   */
  async getOptions(): Promise<PaymentOptionsResponse> {
    const headers = requireAuthHeaders()
    return client.PaymentController_getPaymentOptions({ headers })
  },

  /**
   * 获取支付选项（公开接口，无需登录）
   * 外部商户模式使用
   */
  async getOptionsPublic(): Promise<PaymentOptionsResponse> {
    return client.PaymentController_getExternalPaymentOptions({})
  },

  /**
   * 创建订单并获取跳转链接（需要登录）
   */
  async createOrderAndGetRedirectUrl(
    payload: CreatePaymentOrderRequest,
  ): Promise<{ order: PaymentOrderResponse; redirectUrl?: string }> {
    try {
      const headers = requireAuthHeaders()
      const order = await client.PaymentController_createPaymentOrder(payload, { headers })
      const details = readPaymentDetailsField(order)
      const redirectUrl = extractRedirectUrl(details)
      return { order, redirectUrl }
    } catch (error) {
      console.error('Failed to create payment order', error)
      throw new Error(getUserFriendlyMessage(error))
    }
  },

  /**
   * 创建外部商户订单（无需登录，使用签名验证）
   * 返回精简版订单信息，不包含敏感商户数据
   */
  async createExternalOrder(
    payload: CreateExternalPaymentOrderRequest,
  ): Promise<ExternalOrderPublicResponse> {
    try {
      const order = await client.PaymentController_createExternalPaymentOrder(payload)
      return order
    } catch (error) {
      console.error('Failed to create external payment order', error)
      throw new Error(getUserFriendlyMessage(error))
    }
  },

  /**
   * 根据订单 ID 查询订单详情（需要登录）
   */
  async getOrderById(orderId: string): Promise<PaymentOrderResponse> {
    const headers = requireAuthHeaders()
    return client.PaymentController_getOrderById({ id: orderId }, { headers })
  },

  /**
   * 查询外部订单状态（无需登录，使用签名验证）
   * 注意：此方法需要商户签名，前端一般不直接调用
   * 前端轮询订单状态时，应使用 getOrderById 或者调用后端提供的公开状态查询接口
   */
  async queryExternalOrderStatus(params: {
    merchantId: string
    businessOrderId: string
    timestamp: number
    sign: string
  }): Promise<ExternalOrderStatusResponse> {
    return client.PaymentController_queryExternalOrderStatus(params)
  },

  /**
   * 获取订单详情（公开接口，用于外部模式轮询）
   * 外部模式下订单创建后返回的订单 ID 可以直接查询
   * 仅限查询外部商户创建的订单
   * 返回精简订单信息，不包含敏感商户数据
   */
  async getOrderByIdPublic(orderId: string): Promise<ExternalOrderPublicResponse> {
    return client.PaymentController_getExternalOrderById({ id: orderId })
  },

  getUserFriendlyMessage,
}

export type { PaymentOrderResponse as PaymentOrderResponseDto }
