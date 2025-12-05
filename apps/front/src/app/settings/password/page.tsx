'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Shield, ChevronLeft, KeyRound } from 'lucide-react'

import { AuthGuard } from '@/components/auth-guard'
import { mockChangePassword } from '@/mock'
import { novaiAlert } from '@/lib/swal'

export default function PasswordSettingsPage() {
  return (
    <AuthGuard>
      <PasswordSettingsContent />
    </AuthGuard>
  )
}

function PasswordSettingsContent() {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setError('新密码与确认密码不一致')
      return
    }
    if (newPassword.length < 8) {
        setError('新密码长度不能少于 8 位')
        return
    }

    setLoading(true)
    setError('')
    try {
      await mockChangePassword({ oldPassword, newPassword })
      novaiAlert('密码修改成功')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      setError(err.message || '修改失败，请检查旧密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-[1024px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[#9ca3af] mb-1">
                    <Link href="/dashboard" className="hover:text-white transition-colors flex items-center gap-1">
                        <ChevronLeft className="w-4 h-4" />
                        返回个人中心
                    </Link>
                    <span>/</span>
                    <span>安全设置</span>
                </div>
                <h1 className="text-[36px] font-bold text-white">修改密码</h1>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar Navigation (Mock) */}
            <div className="lg:col-span-1 space-y-2">
                <Link href="/settings/password" className="flex items-center gap-3 px-4 py-3 bg-[#1e293b]/50 text-white rounded-xl border border-[#6366f1]/30 font-medium">
                    <Lock className="w-5 h-5 text-[#6366f1]" />
                    <span>修改密码</span>
                </Link>
                <Link href="/settings/security" className="flex items-center gap-3 px-4 py-3 text-[#9ca3af] hover:bg-[#1e293b]/30 hover:text-white rounded-xl transition-colors font-medium">
                    <Shield className="w-5 h-5" />
                    <span>登录与安全</span>
                </Link>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2">
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8">
                    <div className="max-w-[480px]">
                        <h2 className="text-xl font-bold text-white mb-6">设置新密码</h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[#e5e7eb] text-sm font-medium block">当前密码</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <KeyRound className="h-5 w-5 text-[#6b7280]" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={oldPassword}
                                        onChange={e => setOldPassword(e.target.value)}
                                        className="w-full h-[50px] pl-11 pr-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#e5e7eb] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                                        placeholder="输入当前密码"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[#e5e7eb] text-sm font-medium block">新密码</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-[#6b7280]" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="w-full h-[50px] pl-11 pr-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#e5e7eb] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                                        placeholder="至少 8 位字符"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[#e5e7eb] text-sm font-medium block">确认新密码</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-[#6b7280]" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full h-[50px] pl-11 pr-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#e5e7eb] placeholder-[#4b5563] focus:outline-none focus:border-[#6366f1] transition-colors"
                                        placeholder="再次输入新密码"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                                    {error}
                                </div>
                            )}

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-8 py-3 bg-[#6366f1] hover:bg-[#5558e6] text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? '保存中...' : '保存更改'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}
