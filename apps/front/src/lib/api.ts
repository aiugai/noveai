import { createApiClient, schemas } from '@ai/api-contracts'
import type { z } from 'zod'

import { getToken } from './auth-storage'

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3005/api/v1'

const client = createApiClient(API_BASE_URL, { validate: 'request' })

type LoginPayload = z.infer<typeof schemas.LoginRequestDto>
type RegisterPayload = z.infer<typeof schemas.RegisterRequestDto>
type PasswordResetRequestPayload = z.infer<typeof schemas.PasswordResetRequestDto>
type VerifyResetPayload = z.infer<typeof schemas.VerifyPasswordResetRequestDto>
export type UserProfile = z.infer<typeof schemas.UserProfileResponseDto>

function requireAuthHeaders() {
  const token = getToken()
  if (!token) throw new Error('登录状态已失效，请重新登录')
  return { Authorization: `Bearer ${token}` }
}

export function login(payload: LoginPayload) {
  // 用户登录：/auth/login
  return client.AuthController_login(payload)
}

export function registerAccount(payload: RegisterPayload) {
  // 用户注册：/auth/register
  return client.AuthController_register(payload)
}

export function requestPasswordReset(payload: PasswordResetRequestPayload) {
  // 请求重置密码：/auth/password/reset-request
  return client.AuthController_requestPasswordReset(payload)
}

export function verifyPasswordReset(payload: VerifyResetPayload) {
  // 校验重置密码：/auth/password/reset-verify
  return client.AuthController_verifyPasswordReset(payload)
}

export async function fetchProfile(tokenOverride?: string): Promise<UserProfile> {
  // 获取当前用户信息：/users/me
  const headers = tokenOverride
    ? { Authorization: `Bearer ${tokenOverride}` }
    : requireAuthHeaders()
  return client.UserController_me({ headers })
}

export async function fetchMyWallet() {
  // 获取当前用户钱包（含积分等资产）：/wallets/me
  const headers = requireAuthHeaders()
  return client.WalletController_getMyWallet({ headers })
}
