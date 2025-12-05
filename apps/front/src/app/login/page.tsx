'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, useState, Suspense, useEffect } from 'react'

import { useAuth } from '@/lib/auth-context'
import { extractErrorMessage } from '@/lib/api-error'
import { IconGoogle, IconGithub, LogoIcon, IconCheck } from '@/components/icons'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/dashboard'
  const { login, isAuthenticated } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  // Redirect if already authenticated
  useEffect(() => {
      if (isAuthenticated) {
          router.push('/dashboard')
      }
  }, [isAuthenticated, router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await login({ email, password })
      router.push(redirect)
    } catch (err: any) {
      setError(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center relative overflow-hidden p-4">
      {/* Background Decorations */}
      <div className="absolute top-[10%] left-[10%] w-[384px] h-[384px] bg-[#6366f1] opacity-10 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[384px] h-[384px] bg-[#9333ea] opacity-10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header Logo */}
      <div className="flex items-center gap-3 mb-8 z-10 mt-8">
        <div className="w-[60px] h-[60px] flex items-center justify-center translate-y-2">
          <LogoIcon className="w-full h-full" />
        </div>
        <span className="text-[36px] font-bold text-white tracking-tight">NovAI</span>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-[1024px] bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden z-10 shadow-2xl">
        {/* Tabs */}
        <div className="grid grid-cols-2 border-b border-[#1e293b]">
          <div className="py-5 text-center border-b-2 border-[#6366f1] cursor-default">
            <span className="text-[#6366f1] font-semibold text-base">登录</span>
          </div>
          <Link href="/register" className="py-5 text-center border-b-2 border-transparent hover:bg-[#1e293b]/50 transition-colors">
            <span className="text-[#9ca3af] font-semibold text-base">注册</span>
          </Link>
        </div>

        {/* Form Container */}
        <div className="py-[64px] px-4 flex justify-center">
          <div className="w-full max-w-[448px] space-y-8">

            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">欢迎回来</h1>
              <p className="text-[#9ca3af] text-sm">登录继续您的创作之旅</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[#e5e7eb] text-sm font-medium block">邮箱地址</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full h-[54px] px-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#adaebc] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[#e5e7eb] text-sm font-medium block">密码</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-[54px] px-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#adaebc] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${rememberMe ? 'bg-[#6366f1] border-[#6366f1]' : 'bg-white border-black group-hover:border-[#6366f1]'}`}>
                    {rememberMe && <IconCheck className="w-3 h-3 text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                  />
                  <span className="text-[#9ca3af] text-sm">记住我</span>
                </label>
                <Link href="/forgot-password" className="text-[#6366f1] text-sm hover:underline">
                  忘记密码?
                </Link>
              </div>

              {error && <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] bg-[#6366f1] hover:bg-[#5558e6] text-white rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#1e293b]"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-[#0f172a] text-[#9ca3af]">或使用以下方式登录</span>
              </div>
            </div>

            {/* Social Login */}
            <div className="grid grid-cols-2 gap-4">
              <button className="flex items-center justify-center gap-3 h-[50px] bg-[#020617] border border-[#1e293b] hover:border-[#6366f1]/50 rounded-xl transition-all group">
                <IconGoogle className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="text-[#e5e7eb] text-sm font-medium">Google</span>
              </button>
              <button className="flex items-center justify-center gap-3 h-[50px] bg-[#020617] border border-[#1e293b] hover:border-[#6366f1]/50 rounded-xl transition-all group">
                <IconGithub className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                <span className="text-[#e5e7eb] text-sm font-medium">GitHub</span>
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
