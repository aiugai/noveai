'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useState, useEffect } from 'react'
import { User, Mail, Lock, KeyRound } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { extractErrorMessage } from '@/lib/api-error'
import { IconGoogle, IconGithub, LogoIcon } from '@/components/icons'

export default function RegisterPage() {
  const router = useRouter()
  const { register, isAuthenticated } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirect if already authenticated
  useEffect(() => {
      if (isAuthenticated) {
          router.push('/dashboard')
      }
  }, [isAuthenticated, router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    setError('')
    try {
      await register({
        email,
        password,
        nickname: nickname || undefined,
      })
      router.push('/dashboard')
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
          <Link href="/login" className="py-5 text-center border-b-2 border-transparent hover:bg-[#1e293b]/50 transition-colors">
            <span className="text-[#9ca3af] font-semibold text-base">登录</span>
          </Link>
          <div className="py-5 text-center border-b-2 border-[#6366f1] cursor-default">
            <span className="text-[#6366f1] font-semibold text-base">注册</span>
          </div>
        </div>

        {/* Form Container */}
        <div className="py-[64px] px-4 flex justify-center">
          <div className="w-full max-w-[448px] space-y-8">

            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold text-white">开启创作之旅</h1>
              <p className="text-[#9ca3af] text-sm">注册账号,开始您的 AI 小说创作</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[#e5e7eb] text-sm font-medium block">用户名</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-[#6b7280]" />
                  </div>
                  <input
                    type="text"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    placeholder="您的昵称"
                    className="w-full h-[50px] pl-11 pr-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#adaebc] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[#e5e7eb] text-sm font-medium block">邮箱地址</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-[#6b7280]" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full h-[50px] pl-11 pr-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#adaebc] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[#e5e7eb] text-sm font-medium block">密码</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-[#6b7280]" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="至少 8 个字符"
                    className="w-full h-[50px] pl-11 pr-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#adaebc] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[#e5e7eb] text-sm font-medium block">确认密码</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound className="h-5 w-5 text-[#6b7280]" />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    className="w-full h-[50px] pl-11 pr-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#adaebc] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                  />
                </div>
              </div>

              {error && <div className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded-lg">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[50px] bg-[#6366f1] hover:bg-[#5558e6] text-white rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 mt-2"
              >
                {loading ? '注册中...' : '注册账号'}
              </button>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1e293b]"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#0f172a] text-[#9ca3af]">或使用以下方式注册</span>
                </div>
              </div>

              {/* Social Login */}
              <div className="grid grid-cols-2 gap-4">
                <button type="button" className="flex items-center justify-center gap-2 h-[46px] bg-[#020617] border border-[#1e293b] hover:border-[#6366f1]/50 rounded-xl transition-all group">
                  <IconGoogle className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[#e5e7eb] text-sm font-medium">Google</span>
                </button>
                <button type="button" className="flex items-center justify-center gap-2 h-[46px] bg-[#020617] border border-[#1e293b] hover:border-[#6366f1]/50 rounded-xl transition-all group">
                  <IconGithub className="w-5 h-5 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[#e5e7eb] text-sm font-medium">GitHub</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
