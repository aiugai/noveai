export interface AuthSession {
  accessToken: string
  user: {
    id: string
    email: string
    nickname?: string
    emailVerified: boolean
    membershipTier?: 'NONE' | 'SMALL' | 'BIG'
    /**
     * 会员到期时间（始终存储为 ISO 字符串）；未开通或已过期为 null
     */
    membershipExpireAt?: string | null
  }
}

const TOKEN_KEY = 'accessToken'

export function saveSession(session: AuthSession): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, session.accessToken)
  localStorage.setItem('currentUser', JSON.stringify(session.user))
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem('currentUser')
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function getCurrentUser(): AuthSession['user'] | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('currentUser')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}
