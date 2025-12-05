'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react'

import { login as apiLogin, registerAccount, fetchProfile, type UserProfile } from './api'
import { type AuthSession, saveSession, clearSession, getToken } from './auth-storage'

interface AuthState {
  isAuthenticated: boolean
  user: AuthSession['user'] | null
  isLoading: boolean
  login: (data: any) => Promise<void>
  register: (data: any) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

function mapProfileToSessionUser(profile: UserProfile): AuthSession['user'] {
  return {
    id: profile.id,
    email: profile.email,
    nickname: profile.nickname,
    emailVerified: profile.emailVerified,
    membershipTier: profile.membershipTier ?? 'NONE',
    membershipExpireAt: profile.membershipExpireAt
      ? new Date(profile.membershipExpireAt).toISOString()
      : null,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<AuthSession['user'] | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initAuth = async () => {
      const token = getToken()
      if (!token) {
        setIsAuthenticated(false)
        setUser(null)
        setIsLoading(false)
        return
      }

      try {
        const profile = await fetchProfile()
        const session: AuthSession = {
          accessToken: token,
          user: mapProfileToSessionUser(profile),
        }
        saveSession(session)
        setIsAuthenticated(true)
        setUser(session.user)
      } catch (error) {
        console.error('Auth check failed', error)
        clearSession()
        setIsAuthenticated(false)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    void initAuth()
  }, [])

  const login = async (data: any) => {
    try {
      const res = await apiLogin(data)
      const profile = await fetchProfile(res.accessToken)
      const session: AuthSession = {
        accessToken: res.accessToken,
        user: mapProfileToSessionUser(profile),
      }
      saveSession(session)
      setIsAuthenticated(true)
      setUser(session.user)
    } catch (error) {
      console.error('Login failed', error)
      throw error
    }
  }

  const register = async (data: any) => {
    try {
      const res = await registerAccount(data)
      const profile = await fetchProfile(res.accessToken)
      const session: AuthSession = {
        accessToken: res.accessToken,
        user: mapProfileToSessionUser(profile),
      }
      saveSession(session)
      setIsAuthenticated(true)
      setUser(session.user)
    } catch (error) {
      console.error('Register failed', error)
      throw error
    }
  }

  const logout = () => {
    clearSession()
    setIsAuthenticated(false)
    setUser(null)
  }

  const value = useMemo(
    () => ({
      isAuthenticated,
      user,
      isLoading,
      login,
      register,
      logout,
    }),
    [isAuthenticated, user, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
