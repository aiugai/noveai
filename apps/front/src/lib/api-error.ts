import type { ZodiosError } from '@zodios/core'

// 后端统一错误响应类型（基于 api-contracts 的 ErrorResponseDto 结构进行简化）
export type BackendError = ZodiosError<unknown> & {
  response?: {
    data?: {
      error?: {
        code?: string
      }
      message?: string
    }
  }
}

export function extractErrorMessage(error: unknown): string {
  const fallback = '请求失败，请稍后重试'

  if (!error) return fallback

  const err = error as BackendError
  const code = err?.response?.data?.error?.code
  const messageFromBackend = err?.response?.data?.message

  if (code) {
    const mapped = mapErrorCodeToMessage(code)
    if (mapped) return mapped
  }

  if (typeof messageFromBackend === 'string' && messageFromBackend.trim()) {
    return messageFromBackend
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

export function mapErrorCodeToMessage(code: string): string | null {
  switch (code) {
    // 认证相关
    case 'AUTH_INVALID_CREDENTIALS':
      return '邮箱或密码错误，请检查后重试'
    case 'AUTH_EMAIL_ALREADY_TAKEN':
      return '该邮箱已被注册，请直接登录或更换邮箱'
    case 'AUTH_UNAUTHORIZED':
    case 'UNAUTHORIZED':
      return '登录状态已失效，请重新登录'

    // 频率限制
    case 'TOO_MANY_REQUESTS':
      return '操作过于频繁，请稍后再试'

    // 用户/通用
    case 'USER_NOT_FOUND':
      return '用户不存在，请检查邮箱是否正确'
    case 'BAD_REQUEST':
    case 'UNPROCESSABLE_ENTITY':
      return '提交的数据有误，请检查表单内容'

    default:
      return null
  }
}
