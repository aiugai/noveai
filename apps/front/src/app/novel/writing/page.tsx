'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  Zap, 
  Shield, 
  Flame, 
  RefreshCw
} from 'lucide-react'

import { AuthGuard } from '@/components/auth-guard'
import { mockGetCurrentChapter, mockChooseChapterOption, MockChapterDetail } from '@/mock'
import { showAlert, showConfirm, novaiAlert } from '@/lib/swal'

export default function NovelWritingPage() {
  return (
    <AuthGuard>
      <NovelWritingContent />
    </AuthGuard>
  )
}

function NovelWritingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const novelId = searchParams.get('novelId')
  
  const [chapter, setChapter] = useState<MockChapterDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [autoSave, setAutoSave] = useState(true)
  // Calculate progress based on chapter or mock logic
  const [progress, setProgress] = useState(60)

  const loadChapter = useCallback(() => {
    if (!novelId) return
    setLoading(true)
    mockGetCurrentChapter(novelId!)
      .then(data => {
        setChapter(data)
        setLoading(false)
        setSelectedAction(null)
        // Randomize progress slightly on load to simulate story development
        setProgress(Math.floor(Math.random() * 40) + 30)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [novelId])

  useEffect(() => {
    if (!novelId) {
      router.push('/novels')
      return
    }
    loadChapter()
  }, [novelId, loadChapter])

  const handleActionClick = (actionId: string) => {
    setSelectedAction(actionId)
    // Small timeout to allow UI to update selection state before confirm
    setTimeout(async () => {
        if (await showConfirm("确定选择该行动吗？NovAI 将基于此生成下一章节。")) {
            setLoading(true)
            mockChooseChapterOption({ novelId, chapterId: chapter?.id, optionId: actionId })
                .then(() => {
                    loadChapter()
                    // Increase progress on action taken
                    setProgress(prev => Math.min(prev + 15, 100))
                })
                .catch(() => {
                    showAlert("请求失败")
                    setLoading(false)
                    setSelectedAction(null)
                })
        } else {
            setSelectedAction(null)
        }
    }, 100)
  }

  const handleRestart = async () => {
      if (await showConfirm("确定要重新开始本章选择吗？这将重置当前的进度。")) {
        setSelectedAction(null)
        setLoading(true)
        // Simulate reload/reset
        setTimeout(() => {
            loadChapter()
            showAlert("已重新开始本章")
        }, 500)
      }
  }
  
  const handleSave = () => {
      novaiAlert("保存成功")
  }

  const getActionStyle = (type: string) => {
    switch (type) {
        case 'Action': return { icon: Zap, color: 'text-yellow-400', border: 'hover:border-yellow-400/50' }
        case 'Stealth': return { icon: Shield, color: 'text-blue-400', border: 'hover:border-blue-400/50' }
        case 'Dialogue': return { icon: Flame, color: 'text-red-400', border: 'hover:border-red-400/50' }
        default: return { icon: Zap, color: 'text-gray-400', border: 'hover:border-gray-400/50' }
    }
  }

  if (loading && !chapter) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-82px)]">
        <div className="text-white text-lg">加载中...</div>
      </div>
    )
  }

  if (!chapter) return null

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-8 py-8 flex flex-col lg:flex-row gap-6">
          
      {/* Main Content Area (Left) */}
      <div className="flex-1 flex flex-col gap-6">
        
        {/* Story Card */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 lg:p-10 shadow-xl">
          {/* Header Info */}
          <div className="flex items-center justify-between mb-6 text-xs font-medium">
            <div className="flex items-center gap-3">
              <span className="bg-[#6366f1]/20 text-[#6366f1] px-2 py-1 rounded">第 {chapter.index} 章</span>
              <span className="text-[#6366f1]">当前故事节点：{chapter.currentStoryPoint}</span>
            </div>
            <div className="flex items-center gap-6 text-[#64748b]">
              <span>字数: {(chapter.wordCount || 0).toLocaleString()}</span>
              <span>场景: {chapter.sceneCount}</span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">{chapter.title}</h1>

          {/* Story Text */}
          <div className="space-y-6 text-lg leading-relaxed text-[#cbd5e1] font-light tracking-wide">
            {chapter.content.split('\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p className="text-[#6366f1]/50 italic">...... (此处为本章正文内容，可继续编辑或让 NovAI 续写)</p>
          </div>
        </div>

        {/* Action Selection Area */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-8 shadow-xl">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white mb-1">选择你的行动</h2>
            <p className="text-[#94a3b8] text-sm">这会影响下一章的走向，NovAI 会根据你的选择生成不同的发展路径。</p>
          </div>

          <div className="space-y-4">
            {chapter.options.map((action) => {
              const style = getActionStyle(action.type)
              const Icon = style.icon
              return (
                <div 
                  key={action.id}
                  onClick={() => handleActionClick(action.id)}
                  className={`
                    group relative bg-[#1e293b]/50 border rounded-xl p-5 cursor-pointer transition-all
                    ${selectedAction === action.id 
                      ? 'border-[#6366f1] bg-[#6366f1]/5' 
                      : `border-[#334155] hover:bg-[#1e293b] ${style.border}`}
                  `}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-[#e2e8f0] group-hover:text-white transition-colors">{action.text}</h3>
                    <span className="text-xs px-2 py-0.5 bg-[#0f172a] border border-[#334155] rounded text-[#94a3b8]">
                      {action.type}
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-2 text-xs text-[#64748b]">
                    <Icon className={`w-3.5 h-3.5 mt-0.5 ${style.color}`} />
                    <span>选择此项将触发 {action.type} 剧情分支</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-6 flex justify-center">
            <button 
                onClick={handleRestart}
                className="flex items-center gap-2 text-[#94a3b8] hover:text-white text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新开始本章选择
            </button>
          </div>
        </div>

      </div>

      {/* Sidebar Area (Right) */}
      <div className="w-full lg:w-[320px] flex flex-col gap-6 shrink-0">
        
        {/* Top Control Card */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">第 {chapter.index} 章</h2>
            <div className="flex gap-2">
              <button 
                onClick={handleSave}
                className="px-3 py-1.5 bg-[#6366f1] hover:bg-[#5558e6] border border-[#6366f1] rounded-lg text-xs text-white transition-colors shadow-lg shadow-indigo-500/20 font-medium"
              >
                保存
              </button>
              <Link 
                href="/novels"
                className="px-3 py-1.5 bg-[#1e293b] hover:bg-[#334155] border border-[#334155] rounded-lg text-xs text-[#e2e8f0] transition-colors"
              >
                返回
              </Link>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center text-[#94a3b8]">
              <span>自动保存</span>
              <button 
                onClick={() => setAutoSave(!autoSave)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none ${autoSave ? 'bg-[#22c55e]' : 'bg-[#334155]'}`}
              >
                <div 
                  className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ease-in-out ${autoSave ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
            </div>
            <div className="flex justify-between items-center text-[#94a3b8]">
              <span>字数约</span>
              <span className="text-[#e2e8f0]">{(chapter.wordCount || 0).toLocaleString()}</span>
            </div>
            <div className="h-px bg-[#334155]" />
            <div className="flex justify-between items-center text-[#94a3b8]">
              <span>场景数量: {chapter.sceneCount}</span>
              <span className="text-[#94a3b8]">章节标签: 剧情</span>
            </div>
            
            {/* Dynamic Progress Bar */}
             <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-[#94a3b8]">
                <span>故事发展阶段</span>
                <span className="text-[#6366f1]">{progress}%</span>
              </div>
              <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                <div 
                    className="h-full bg-[#6366f1] rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
          </div>
        </div>

        {/* Character Info */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-[#6366f1] rounded-full" />
            <h3 className="text-sm font-bold text-white">角色信息</h3>
          </div>
          <div className="space-y-4">
            {chapter.characters.map((char, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-[#334155] bg-slate-800 flex items-center justify-center text-xs">
                  {char.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#e2e8f0]">{char.name}</div>
                  <div className="text-[10px] text-[#94a3b8] truncate">{char.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Story Style */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-4 bg-[#6366f1] rounded-full" />
            <h3 className="text-sm font-bold text-white">故事风格</h3>
          </div>
          <div className="space-y-4">
            <div className="bg-[#1e293b]/50 rounded-lg p-3 text-center border border-[#334155]">
              <span className="text-sm text-[#e2e8f0]">冒险 / 悬疑</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[#94a3b8]">
                <span>紧张度</span>
                <span className="text-yellow-400">中</span>
              </div>
              <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                <div className="h-full w-[60%] bg-yellow-400 rounded-full" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
