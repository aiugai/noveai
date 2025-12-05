'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Lock, Shield, ChevronLeft, Smartphone, Globe, History, Trash2 } from 'lucide-react'

import { AuthGuard } from '@/components/auth-guard'
import { mockGetLoginHistory, MockLoginHistory } from '@/mock'
import { showAlert, showConfirm, novaiAlert } from '@/lib/swal'

export default function SecuritySettingsPage() {
  return (
    <AuthGuard>
      <SecuritySettingsContent />
    </AuthGuard>
  )
}

function SecuritySettingsContent() {
  const [history, setHistory] = useState<MockLoginHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)

  useEffect(() => {
    mockGetLoginHistory()
      .then(data => {
        setHistory(data)
        setLoading(false)
      })
      .catch(console.error)
  }, [])

  const handleToggle2FA = async () => {
      if (twoFactorEnabled) {
          if (await showConfirm('确定要关闭两步验证吗？', '您的账户安全性将会降低。')) {
              setTwoFactorEnabled(false)
              novaiAlert('两步验证已关闭')
          }
      } else {
          setTwoFactorEnabled(true)
          novaiAlert('两步验证已开启')
      }
  }

  const handleDeleteAccount = async () => {
      await showAlert('请联系客服注销账号', '为了保障您的权益，注销账号需人工审核。')
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
                <h1 className="text-[36px] font-bold text-white">登录与安全</h1>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1 space-y-2">
                <Link href="/settings/password" className="flex items-center gap-3 px-4 py-3 text-[#9ca3af] hover:bg-[#1e293b]/30 hover:text-white rounded-xl transition-colors font-medium">
                    <Lock className="w-5 h-5" />
                    <span>修改密码</span>
                </Link>
                <Link href="/settings/security" className="flex items-center gap-3 px-4 py-3 bg-[#1e293b]/50 text-white rounded-xl border border-[#6366f1]/30 font-medium">
                    <Shield className="w-5 h-5 text-[#6366f1]" />
                    <span>登录与安全</span>
                </Link>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
                
                {/* 2FA Section */}
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-white">两步验证 (2FA)</h2>
                            <p className="text-[#9ca3af] text-sm max-w-[400px]">
                                在登录时需要提供额外的验证码，为您的账户提供最高级别的安全保护。
                            </p>
                        </div>
                        <button 
                            onClick={handleToggle2FA}
                            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none ${twoFactorEnabled ? 'bg-[#6366f1]' : 'bg-[#334155]'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${twoFactorEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Login History */}
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <History className="w-5 h-5 text-[#6366f1]" />
                        最近登录活动
                    </h2>
                    
                    {loading ? (
                        <div className="text-[#9ca3af] text-sm">加载中...</div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((item) => (
                                <div key={item.id} className="flex items-center justify-between py-4 border-b border-[#1e293b] last:border-0">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-[#1e293b] flex items-center justify-center">
                                            {item.device.toLowerCase().includes('mobile') || item.device.toLowerCase().includes('iphone') ? (
                                                <Smartphone className="w-5 h-5 text-[#9ca3af]" />
                                            ) : (
                                                <Globe className="w-5 h-5 text-[#9ca3af]" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-[#e5e7eb] font-medium">{item.device}</div>
                                            <div className="text-[#9ca3af] text-xs">{item.location} • {item.ip}</div>
                                        </div>
                                    </div>
                                    <div className="text-[#9ca3af] text-sm">{item.time}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Delete Account */}
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8">
                    <h2 className="text-xl font-bold text-red-500 mb-4 flex items-center gap-2">
                        <Trash2 className="w-5 h-5" />
                        删除账号
                    </h2>
                    <p className="text-[#9ca3af] text-sm mb-6">
                        删除账号是不可逆的操作。所有的作品、设置和会员权益将被永久清除。
                    </p>
                    <button 
                        onClick={handleDeleteAccount}
                        className="px-6 py-2.5 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-xl text-sm font-medium transition-colors"
                    >
                        申请删除账号
                    </button>
                </div>

            </div>
        </div>
    </div>
  )
}

