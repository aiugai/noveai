'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { FileText, Type, Gem, Crown, ChevronDown } from 'lucide-react'

import { useAuth } from '@/lib/auth-context'
import { AuthGuard } from '@/components/auth-guard'
import { mockGetDashboardSummary, MockDashboardSummary } from '@/mock'
import { fetchMyWallet } from '@/lib/api'

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  )
}

function DashboardContent() {
  const router = useRouter()
  const { user } = useAuth()
  const [summary, setSummary] = useState<MockDashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [scoreBalance, setScoreBalance] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        // 1. 仪表盘统计（目前仍使用 mock 数据）
        const data = await mockGetDashboardSummary()
        if (!cancelled) {
          setSummary(data)
        }

        // 2. 查询真实钱包积分（SCORE）
        try {
          const wallet = await fetchMyWallet()
          if (!cancelled && wallet?.assets) {
            const scoreAsset = wallet.assets.find((a: any) => a.code === 'SCORE')
            if (scoreAsset?.balance != null) {
              const value = Number(scoreAsset.balance)
              if (Number.isFinite(value)) {
                setScoreBalance(value)
              }
            }
          }
        } catch (e) {
          // 钱包接口失败时，不阻塞页面，只在控制台提示
          console.error('加载钱包积分失败', e)
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-82px)] flex items-center justify-center">
        <div className="text-white text-lg">加载中...</div>
      </div>
    )
  }

  const avatarUrl = user?.avatarUrl || 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix'

  const membershipTier = user?.membershipTier ?? 'NONE'
  const membershipLabel =
    membershipTier === 'BIG'
      ? '大会员'
      : membershipTier === 'SMALL'
        ? '小会员'
        : '普通用户'

  let membershipExpireText = '未开通会员'
  if (membershipTier !== 'NONE' && user?.membershipExpireAt) {
    const d = new Date(user.membershipExpireAt)
    if (!Number.isNaN(d.getTime())) {
      membershipExpireText = `至 ${d.toLocaleDateString('zh-CN')}`
    }
  }

  const handleNovelClick = (id: string, status: string) => {
    if (status === 'completed') {
        router.push('/novels')
    } else {
        router.push(`/novel/writing?novelId=${id}`)
    }
  }

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Page Title */}
        <div className="space-y-2">
          <h1 className="text-[48px] font-bold text-white">个人中心</h1>
          <p className="text-[#9ca3af] text-lg">管理您的账户信息、创作数据和会员权益</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Works Stat */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-[#e5e7eb]/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
              <span className="text-[#9ca3af] text-xs">总计</span>
            </div>
            <div className="space-y-1">
              <div className="text-[24px] font-bold text-white">{summary?.totalNovels || 0}</div>
              <div className="text-[#9ca3af] text-sm">创作小说</div>
            </div>
          </div>

          {/* Words Stat */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-[#e5e7eb]/10 flex items-center justify-center">
                <Type className="w-5 h-5 text-purple-500" />
              </div>
              <span className="text-[#9ca3af] text-xs">累计</span>
            </div>
            <div className="space-y-1">
              <div className="text-[24px] font-bold text-white">{(summary?.totalWords || 0).toLocaleString()}</div>
              <div className="text-[#9ca3af] text-sm">创作字数</div>
            </div>
          </div>

          {/* Points Stat */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-[#e5e7eb]/10 flex items-center justify-center">
                <Gem className="w-5 h-5 text-pink-500" />
              </div>
              <span className="text-[#9ca3af] text-xs">剩余</span>
            </div>
            <div className="space-y-1">
              <div className="text-[24px] font-bold text-white">
                {(scoreBalance ?? 0).toLocaleString()}
              </div>
              <div className="text-[#9ca3af] text-sm">账户积分（SCORE）</div>
            </div>
          </div>

          {/* Membership Card */}
           <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5 flex flex-col justify-between min-h-[140px]">
            <div className="flex justify-between items-start">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-[#e5e7eb]/10 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-500" />
              </div>
              <span className="text-[#9ca3af] text-xs">会员</span>
            </div>
            <div className="space-y-1">
              <div className="text-[24px] font-bold text-white">{membershipLabel}</div>
              <div className="text-[#9ca3af] text-sm">{membershipExpireText}</div>
            </div>
          </div>
        </div>

        {/* Profile & Trend Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
          {/* Profile Card */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 flex flex-col items-center">
             <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden relative">
                   <Image src={avatarUrl} alt="User Avatar" fill className="object-cover" />
                </div>
                <button className="absolute bottom-0 right-0 w-8 h-8 bg-[#6366f1] rounded-full flex items-center justify-center border border-[#0f172a]">
                   <div className="w-3 h-3 border-2 border-white rounded-full opacity-50"></div>
                </button>
             </div>
             <h2 className="text-xl font-bold text-white mb-2">{user?.nickname || 'User'}</h2>
             <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#6366f1]/10 border border-[#6366f1]/30 mb-8">
                <Crown className="w-3 h-3 text-[#6366f1]" />
                <span className="text-xs font-medium text-[#6366f1]">{membershipLabel}</span>
             </div>

             <div className="w-full space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                   <span className="text-[#9ca3af] text-sm">注册时间</span>
                   <span className="text-[#e5e7eb] text-sm">2024-06-15</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                   <span className="text-[#9ca3af] text-sm">最后登录</span>
                   <span className="text-[#e5e7eb] text-sm">刚刚</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                   <span className="text-[#9ca3af] text-sm">账户状态</span>
                   <span className="text-green-400 text-sm">正常</span>
                </div>
             </div>
          </div>

          {/* Trend Card (Placeholder) */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 flex flex-col">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-bold text-white">创作趋势</h3>
                <div className="relative group">
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-[#020617] border border-[#1e293b] rounded-lg hover:border-[#6366f1]/50 transition-colors cursor-pointer">
                     <span className="text-sm text-[#e5e7eb]">最近7天</span>
                     <ChevronDown className="w-4 h-4 text-[#9ca3af]" />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-32 bg-[#0f172a] border border-[#1e293b] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-white bg-[#1e293b]">最近7天</div>
                      <div className="px-4 py-2 text-sm text-[#9ca3af] hover:bg-[#1e293b]/50 hover:text-white cursor-pointer">最近30天</div>
                      <div className="px-4 py-2 text-sm text-[#9ca3af] hover:bg-[#1e293b]/50 hover:text-white cursor-pointer">最近3个月</div>
                    </div>
                  </div>
                </div>
             </div>
             <div className="flex-1 flex items-center justify-center border border-dashed border-slate-800 rounded-xl bg-[#020617]/50">
                <p className="text-slate-500">图表区域 (Coming Soon)</p>
             </div>
          </div>
        </div>

        {/* Recent Works */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8">
           <h3 className="text-xl font-bold text-white mb-6">最近创作</h3>
           <div className="space-y-4">
              {summary?.recentNovels && summary.recentNovels.length > 0 ? (
                 summary.recentNovels.map((item, i) => (
                    <div
                        key={i}
                        onClick={() => handleNovelClick(item.id, item.status)}
                        className="flex items-center justify-between p-4 bg-[#020617]/50 border border-[#1e293b] rounded-xl hover:border-[#6366f1]/30 transition-colors group cursor-pointer"
                    >
                       <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-xl ${i % 2 === 0 ? 'bg-blue-500/10' : 'bg-purple-500/10'} flex items-center justify-center`}>
                             <FileText className={`w-5 h-5 ${i % 2 === 0 ? 'text-blue-500' : 'text-purple-500'}`} />
                          </div>
                          <div>
                             <h4 className="text-white font-semibold group-hover:text-[#6366f1] transition-colors">{item.title}</h4>
                             <p className="text-sm text-[#9ca3af]">{item.updatedAt}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                           <span className={`text-xs px-2 py-1 rounded-full ${
                               item.status === 'writing' ? 'bg-green-500/20 text-green-400' :
                               item.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                               'bg-red-500/20 text-red-400'
                           }`}>
                               {item.status === 'writing' ? '创作中' : item.status === 'completed' ? '已完结' : '已弃坑'}
                           </span>
                           <span className="text-sm text-[#e5e7eb] font-mono">{item.wordCount.toLocaleString()}字</span>
                       </div>
                    </div>
                 ))
              ) : (
                  <div className="text-center text-[#9ca3af] py-8">暂无最近创作</div>
              )}
           </div>
        </div>
    </div>
  )
}
