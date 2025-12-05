import { createApiClient, schemas } from '@ai/api-contracts'
import type { z } from 'zod'

import { getToken } from './session'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3005/api/v1'

const client = createApiClient(API_BASE_URL, { validate: 'request' })

type AdminLoginPayload = z.infer<typeof schemas.AdminLoginDto>
type AdminRegisterPayload = z.infer<typeof schemas.AdminRegisterDto>
type CreateMenuPayload = z.infer<typeof schemas.CreateMenuDto>
type CreateRolePayload = z.infer<typeof schemas.CreateRoleDto>
type UpdateRolePayload = z.infer<typeof schemas.UpdateRoleDto>
type CreateAdminUserPayload = z.infer<typeof schemas.CreateAdminUserDto>
type UpdateAdminUserPayload = z.infer<typeof schemas.UpdateAdminUserDto>
type ChangeAdminPasswordPayload = z.infer<typeof schemas.ChangeAdminPasswordDto>

function requireAuthHeaders() {
  const token = getToken()
  if (!token) throw new Error('登录状态已失效，请重新登录')
  return { Authorization: `Bearer ${token}` }
}

export interface AdminRole {
  id: string
  code: string
  name: string
  description?: string | null
  menuPermissions: string[]
}

export interface AdminMenuNode {
  id: string
  title: string
  type: 'DIRECTORY' | 'MENU' | 'FEATURE'
  code?: string | null
  path?: string | null
  parentId?: string | null
  icon?: string | null
  i18nKey?: string | null
  sort?: number | null
  isShow?: boolean | null
}

// 对应后端 AdminAssignedRoleDto（扁平结构，不含 menuPermissions）
export interface AdminAssignedRole {
  id: string
  code: string
  name: string
  description?: string | null
}

export interface AdminUser {
  id: string
  username: string
  email?: string | null
  nickName?: string | null
  isFrozen: boolean
  roles: AdminAssignedRole[]
}

// 前台用户管理（Admin 视角）
export type FrontUser = z.infer<typeof schemas.AdminManagedUserDto>
export type FrontUserListResponse = z.infer<typeof schemas.AdminUserListResponseDto>
export type CreateFrontUserPayload = z.infer<typeof schemas.AdminCreateUserDto>
export type UpdateFrontUserPayload = z.infer<typeof schemas.AdminUpdateUserDto>
export type ResetFrontUserPasswordPayload = z.infer<typeof schemas.AdminResetUserPasswordDto>
export interface FrontUserListQuery {
  page?: number
  limit?: number
  keyword?: string
  status?: FrontUser['status']
}

export function loginAdmin(payload: AdminLoginPayload) {
  return client.AdminAuthController_login(payload)
}

export function registerAdmin(payload: AdminRegisterPayload) {
  return client.AdminAuthController_register(payload)
}

export function changeAdminPassword(payload: ChangeAdminPasswordPayload) {
  return client.AdminAuthController_changePassword(payload, { headers: requireAuthHeaders() })
}

export async function fetchAdminMenus(): Promise<AdminMenuNode[]> {
  const response = (await client.MenuController_list({ headers: requireAuthHeaders() })) as unknown
  return (response ?? []) as AdminMenuNode[]
}

export function createMenu(payload: CreateMenuPayload) {
  return client.MenuController_create(payload, { headers: requireAuthHeaders() })
}

export async function fetchAdminRoles(): Promise<AdminRole[]> {
  const response = (await client.RoleController_list({ headers: requireAuthHeaders() })) as unknown
  return (response ?? []) as AdminRole[]
}

export function createRole(payload: CreateRolePayload) {
  return client.RoleController_create(payload, { headers: requireAuthHeaders() })
}

export function updateRole(id: string, payload: UpdateRolePayload) {
  return client.RoleController_update(payload, {
    headers: requireAuthHeaders(),
    params: { id },
  })
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const response = (await client.AdminUserController_list({ headers: requireAuthHeaders() })) as unknown
  return (response ?? []) as AdminUser[]
}

export function createAdminUser(payload: CreateAdminUserPayload) {
  return client.AdminUserController_create(payload, { headers: requireAuthHeaders() })
}

export function updateAdminUser(id: string, payload: UpdateAdminUserPayload) {
  return client.AdminUserController_update(payload, {
    headers: requireAuthHeaders(),
    params: { id },
  })
}

// 前台用户管理相关 API
export function fetchFrontUsers(params?: FrontUserListQuery): Promise<FrontUserListResponse> {
  return (client as any).UserAdminController_list({
    headers: requireAuthHeaders(),
    queries: (params ?? {}) as any,
  }) as Promise<FrontUserListResponse>
}

export function fetchFrontUserDetail(id: string): Promise<FrontUser> {
  return (client as any).UserAdminController_detail({
    headers: requireAuthHeaders(),
    params: { id },
  }) as Promise<FrontUser>
}

export function createFrontUser(payload: CreateFrontUserPayload): Promise<FrontUser> {
  return (client as any).UserAdminController_create(payload, { headers: requireAuthHeaders() }) as Promise<FrontUser>
}

export function updateFrontUser(id: string, payload: UpdateFrontUserPayload): Promise<FrontUser> {
  return (client as any).UserAdminController_update(payload, {
    headers: requireAuthHeaders(),
    params: { id },
  }) as Promise<FrontUser>
}

export function deleteFrontUser(id: string) {
  return (client as any).UserAdminController_remove({
    headers: requireAuthHeaders(),
    params: { id },
  })
}

export function resetFrontUserPassword(id: string, payload: ResetFrontUserPasswordPayload) {
  return (client as any).UserAdminController_resetPassword(payload, {
    headers: requireAuthHeaders(),
    params: { id },
  })
}

// 支付订单管理
export type AdminPaymentOrderStatus =
  | 'PENDING'
  | 'COMPLETED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'

export type PaymentOrderSourceType = 'INTERNAL' | 'EXTERNAL'

export type CallbackStatus = 'PENDING' | 'SUCCESS' | 'FAILED'

export interface AdminPaymentOrder {
  id: string
  userId: string
  amount: string
  currency: string
  channel: string
  status: AdminPaymentOrderStatus
  externalOrderId: string | null
  sourceType: PaymentOrderSourceType
  merchantId: string | null
  externalUserId: string | null
  businessOrderId: string | null
  description: string | null
  callbackStatus: CallbackStatus | null
  callbackAttempts: number | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface AdminPaymentOrderDetail extends AdminPaymentOrder {
  targetAssetTypeId: string | null
  targetAssetAmount: string | null
  exchangeRate: string | null
  paymentDetails: Record<string, unknown> | null
  callbackData: Record<string, unknown> | null
  expiresAt: string | null
}

export interface AdminPaymentOrdersResponse {
  total: number
  page: number
  limit: number
  hasNext: boolean
  items: AdminPaymentOrder[]
}

export interface FetchAdminPaymentOrdersParams {
  page?: number
  limit?: number
  userId?: string
  status?: AdminPaymentOrderStatus
  channel?: string
  startTime?: string
  endTime?: string
  sourceType?: PaymentOrderSourceType
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: HeadersInit
}

async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = `${API_BASE_URL}${path}`
  const headers: HeadersInit = {
    Accept: 'application/json',
    ...requireAuthHeaders(),
    ...(options.headers ?? {}),
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    let message = '请求失败，请稍后重试'
    try {
      const data = (await response.json()) as { message?: string }
      if (data?.message) {
        message = data.message
      }
    } catch {
      const text = await response.text()
      if (text) message = text
    }
    throw new Error(message)
  }

  return (await response.json()) as T
}

export async function fetchAdminPaymentOrders(
  params: FetchAdminPaymentOrdersParams = {},
): Promise<AdminPaymentOrdersResponse> {
  const search = new URLSearchParams()
  if (params.page) search.set('page', String(params.page))
  if (params.limit) search.set('limit', String(params.limit))
  if (params.userId) search.set('userId', params.userId)
  if (params.status) search.set('status', params.status)
  if (params.channel) search.set('channel', params.channel)
  if (params.startTime) search.set('startTime', params.startTime)
  if (params.endTime) search.set('endTime', params.endTime)
  if (params.sourceType) search.set('sourceType', params.sourceType)

  const queryString = search.toString()
  const path = `/admin/payment/orders${queryString ? `?${queryString}` : ''}`
  return requestJson<AdminPaymentOrdersResponse>(path)
}

export function fetchAdminPaymentOrderDetail(id: string) {
  return requestJson<AdminPaymentOrderDetail>(`/admin/payment/orders/${id}`)
}

export interface SimulateAdminRechargePayload {
  userId: string
  packageId: string
  method?: 'WECHAT' | 'ALIPAY' | 'CREDIT_CARD'
  targetAssetCode?: string
  success?: boolean
}

export function simulateAdminRecharge(payload: SimulateAdminRechargePayload) {
  return requestJson<AdminPaymentOrderDetail>('/admin/payment/orders/simulate-recharge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })
}

/**
 * 对已存在的 PENDING 订单模拟支付成功回调
 * 仅非生产环境可用
 */
export async function simulateOrderCallback(orderId: string): Promise<AdminPaymentOrderDetail> {
  // POST 请求无 body 时，需要传递 undefined 作为第一个参数
  const result = await client.PaymentOrdersController_simulateCallback(undefined, {
    headers: requireAuthHeaders(),
    params: { id: orderId },
  })
  return result as AdminPaymentOrderDetail
}

/**
 * 手动重试商户回调通知
 * 仅对外部订单且回调失败状态有效
 */
export async function retryOrderCallback(orderId: string): Promise<AdminPaymentOrderDetail> {
  const result = await client.PaymentOrdersController_retryCallback(undefined, {
    headers: requireAuthHeaders(),
    params: { id: orderId },
  })
  return result as AdminPaymentOrderDetail
}

// 系统配置管理
type SettingValue = string | number | boolean | Record<string, unknown> | unknown[] | null

export type AdminSettingType = 'string' | 'number' | 'boolean' | 'json'

export interface AdminSetting {
  id: string
  key: string
  value: SettingValue | string
  type: AdminSettingType
  description?: string
  category?: string
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

interface BaseSettingPayload {
  value: SettingValue | string
  type?: AdminSettingType
  description?: string
  category?: string
  isSystem?: boolean
}

export interface CreateAdminSettingPayload extends BaseSettingPayload {
  key: string
}

export type UpdateAdminSettingPayload = BaseSettingPayload

async function requestAdminSettingsApi<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const headers = {
    'Content-Type': 'application/json',
    ...requireAuthHeaders(),
    ...(init?.headers ?? {}),
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })

  if (!response.ok) {
    let message = '配置接口请求失败'
    try {
      const errorBody = await response.json()
      message = errorBody?.message ?? errorBody?.error ?? message
    } catch {
      // ignore json parse errors
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as TResponse
  }

  return (await response.json()) as TResponse
}

export async function fetchAdminSettings(category?: string): Promise<AdminSetting[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : ''
  return requestAdminSettingsApi<AdminSetting[]>(`/admin/settings${query}`, { method: 'GET' })
}

export function createAdminSetting(payload: CreateAdminSettingPayload) {
  return requestAdminSettingsApi<AdminSetting>(`/admin/settings`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateAdminSetting(key: string, payload: UpdateAdminSettingPayload) {
  return requestAdminSettingsApi<AdminSetting>(`/admin/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function reloadAdminSettings() {
  return requestAdminSettingsApi<{ success: boolean }>(`/admin/settings`, {
    method: 'PATCH',
  })
}

// 充值套餐管理
export type RechargePackageStatus = 'ACTIVE' | 'INACTIVE'

export interface RechargePackage {
  id: string
  name: string
  displayTitle: string
  badgeLabel: string
  priceAmount: string
  priceCurrency: string
  baseScore: number
  bonusPercent: number
  totalScore: number
  sortOrder: number
  status: RechargePackageStatus
  metadata?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface RechargePackagesResponse {
  total: number
  page: number
  limit: number
  hasNext: boolean
  items: RechargePackage[]
}

export interface FetchRechargePackagesParams {
  page?: number
  limit?: number
  status?: RechargePackageStatus
}

export interface CreateRechargePackagePayload {
  name: string
  displayTitle: string
  badgeLabel: string
  priceAmount: string
  priceCurrency: string
  baseScore: number
  bonusPercent: number
  totalScore: number
  sortOrder?: number
  metadata?: Record<string, unknown>
}

export interface UpdateRechargePackagePayload {
  name?: string
  displayTitle?: string
  badgeLabel?: string
  priceAmount?: string
  priceCurrency?: string
  baseScore?: number
  bonusPercent?: number
  totalScore?: number
  sortOrder?: number
  status?: RechargePackageStatus
  metadata?: Record<string, unknown>
}

export async function fetchRechargePackages(
  params: FetchRechargePackagesParams = {},
): Promise<RechargePackagesResponse> {
  const search = new URLSearchParams()
  if (params.page) search.set('page', String(params.page))
  if (params.limit) search.set('limit', String(params.limit))
  if (params.status) search.set('status', params.status)

  const queryString = search.toString()
  const path = `/admin/payments/recharge-packages${queryString ? `?${queryString}` : ''}`
  return requestJson<RechargePackagesResponse>(path)
}

export function fetchRechargePackageById(id: string) {
  return requestJson<RechargePackage>(`/admin/payments/recharge-packages/${id}`)
}

export function createRechargePackage(payload: CreateRechargePackagePayload) {
  return requestJson<RechargePackage>('/admin/payments/recharge-packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })
}

export function updateRechargePackage(id: string, payload: UpdateRechargePackagePayload) {
  return requestJson<RechargePackage>(`/admin/payments/recharge-packages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
  })
}

export async function toggleRechargePackageStatus(id: string, currentStatus: RechargePackageStatus) {
  const newStatus: RechargePackageStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  return updateRechargePackage(id, { status: newStatus })
}
