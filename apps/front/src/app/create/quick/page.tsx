'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { 
  IconGenerate,
  IconSparkles
} from '@/components/icons'
import { Lightbulb, ChevronDown, Search, Heart, Rocket, GraduationCap, Swords, MoreHorizontal } from 'lucide-react'

import { AuthGuard } from '@/components/auth-guard'
import { mockQuickCreateNovel } from '@/mock'
import { showAlert, showConfirm } from '@/lib/swal'

const NOVEL_TYPES = [
  { id: 'fantasy', label: '玄幻 / 仙侠', icon: Swords },
  { id: 'urban', label: '都市情感', icon: Heart },
  { id: 'scifi', label: '科幻 / 末日', icon: Rocket },
  { id: 'suspense', label: '悬疑推理', icon: Search },
  { id: 'school', label: '二次元 / 校园', icon: GraduationCap },
  { id: 'other', label: '其他', icon: MoreHorizontal },
]

export default function QuickCreatePage() {
  return (
    <AuthGuard>
      <QuickCreateContent />
    </AuthGuard>
  )
}

function QuickCreateContent() {
  const router = useRouter()
  const [idea, setIdea] = useState('')
  const [category, setCategory] = useState('fantasy')
  const [chapterLength, setChapterLength] = useState('standard')
  const [style, setStyle] = useState('default')
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    if (idea.length < 10) {
      showAlert("创意描述至少需要 10 个字")
      return
    }
    
    setIsGenerating(true)
    try {
      const res = await mockQuickCreateNovel({ 
        prompt: idea, 
        category, 
        chapterLength, 
        style 
      })
      router.push(`/novel/writing?novelId=${res.novelId}`)
    } catch (err: any) {
      console.error(err)
      if (err.message && err.message.includes("点数不足")) {
         if (await showConfirm("创作点不足，是否前往充值中心？")) {
             router.push('/recharge')
         }
      } else {
         showAlert("请求失败")
      }
      setIsGenerating(false)
    }
  }

  return (
    <div className="w-full max-w-[1000px] mx-auto px-4 sm:px-8 py-12 z-10">
        
        <div className="mb-10 text-center space-y-4">
          <h1 className="text-[40px] font-bold text-white">快速创建小说</h1>
          <p className="text-[#9ca3af] text-lg">一句话描述你的故事，NovAI 将自动生成设定、大纲和第一章草稿。</p>
        </div>

        <div className="bg-[#0f172a]/80 backdrop-blur-sm border border-[#1e293b] rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden">
          
          <div className="space-y-8 relative z-10">
            
            {/* Idea Input */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="idea" className="flex items-center gap-2 text-sm font-medium text-[#e2e8f0]">
                  <IconGenerate className="w-4 h-4 text-[#6366f1]" />
                  一句话创意
                </label>
                <span className="bg-[#1e293b] text-[#9ca3af] text-xs px-2 py-1 rounded text-[10px]">AI 智能辅助中</span>
              </div>
              <div className="relative group">
                <textarea
                  id="idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder="例如：末日废土 + 进化系统 + 冷静独行女主 + 城市探索..."
                  className="w-full h-[140px] bg-[#020617] border border-[#334155] rounded-xl p-4 text-white placeholder-[#64748b] focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] transition-all resize-none text-base leading-relaxed"
                />
                <div className="absolute bottom-3 right-3 text-xs text-[#64748b] bg-[#020617] px-2 py-0.5 rounded border border-[#334155]/50">
                  {idea.length}/10
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-[#94a3b8]">
                <Lightbulb className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p>建议：写出题材 / 世界观 / 主角标签 / 核心冲突，越具体越有画面感。</p>
              </div>
            </div>

            {/* Novel Types */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-[#e2e8f0]">
                选择小说类型 <span className="text-[#64748b] font-normal">(可选)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {NOVEL_TYPES.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setCategory(type.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border
                      ${category === type.id 
                        ? 'bg-gradient-to-r from-[#6366f1]/20 to-[#9333ea]/20 border-[#6366f1] text-[#6366f1]' 
                        : 'bg-[#020617] border-[#334155] text-[#9ca3af] hover:border-[#6366f1]/50 hover:text-[#e2e8f0]'}
                    `}
                  >
                    <type.icon className="w-4 h-4" />
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dropdowns Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Chapter Length */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">章节长度</label>
                <div className="relative">
                  <select 
                    value={chapterLength}
                    onChange={(e) => setChapterLength(e.target.value)}
                    className="w-full h-[46px] appearance-none bg-[#020617] border border-[#334155] rounded-xl px-4 text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] cursor-pointer"
                  >
                    <option value="short">短章节 (1000 ~ 2000 字)</option>
                    <option value="standard">标准章节 (2000 ~ 3000 字)</option>
                    <option value="long">长章节 (3000 ~ 5000 字)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                </div>
              </div>

              {/* Style */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#e2e8f0]">
                  整体风格 <span className="text-[#64748b] font-normal">(可选)</span>
                </label>
                <div className="relative">
                  <select 
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full h-[46px] appearance-none bg-[#020617] border border-[#334155] rounded-xl px-4 text-[#e2e8f0] focus:outline-none focus:border-[#6366f1] cursor-pointer"
                  >
                    <option value="default">默认</option>
                    <option value="dark">黑暗压抑</option>
                    <option value="humorous">轻松幽默</option>
                    <option value="epic">史诗宏大</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button 
                onClick={handleGenerate}
                disabled={idea.length < 10 || isGenerating}
                className={`
                  w-full h-[56px] rounded-xl bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white font-bold text-lg 
                  hover:opacity-90 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2
                  ${(idea.length < 10 || isGenerating) ? 'opacity-70 cursor-not-allowed' : ''}
                `}
              >
                {isGenerating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    正在构建世界...
                  </>
                ) : (
                  <>
                    开始生成
                    <IconSparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>

            {/* Bottom Notes */}
            <div className="pt-4 border-t border-[#334155]/50 space-y-2">
              <p className="flex items-center gap-2 text-xs text-[#94a3b8]">
                <span className="w-1 h-1 rounded-full bg-[#6366f1]"></span>
                点击后将自动创建一个新小说项目，并跳转到「创作编辑器」。
              </p>
              <p className="flex items-center gap-2 text-xs text-[#94a3b8]">
                <span className="w-1 h-1 rounded-full bg-[#6366f1]"></span>
                NovAI 会先生成标题、简介、人物卡和世界观，再生成第一章草稿。
              </p>
              <p className="flex items-center gap-2 text-xs text-[#94a3b8]">
                <span className="w-1 h-1 rounded-full bg-[#6366f1]"></span>
                生成结果可以在编辑器中随时修改、重写或继续续写。
              </p>
            </div>

          </div>
        </div>
    </div>
  )
}
