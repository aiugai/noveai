'use client'

import { useRouter } from 'next/navigation'
import { 
  IconGenerate,
  IconCheck
} from '@/components/icons'
import { SlidersHorizontal } from 'lucide-react'

import { AuthGuard } from '@/components/auth-guard'
import { showAlert } from '@/lib/swal'

export default function CreateNovelPage() {
  return (
    <AuthGuard>
      <CreateNovelContent />
    </AuthGuard>
  )
}

function CreateNovelContent() {
  const router = useRouter()

  const handleQuickCreate = () => {
    router.push('/create/quick')
  }

  const handleAdvancedCreate = () => {
    showAlert("高级创作模式开发中")
  }

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-16">
      
      <div className="flex flex-col items-center gap-12">
        {/* Page Title */}
        <div className="text-center space-y-4">
          <h1 className="text-[48px] font-bold text-white">创建您的小说</h1>
          <p className="text-[#9ca3af] text-lg">选择创建模式，让AI助您快速开启创作之旅</p>
        </div>

        {/* Creation Mode Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-[1000px]">
          
          {/* Quick Create Card */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-3xl p-10 flex flex-col relative group hover:border-[#6366f1]/50 transition-all">
            <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-[#1e293b] border border-[#6366f1] text-xs text-[#6366f1]">
              推荐
            </div>
            
            <div className="w-14 h-14 rounded-2xl bg-[#6366f1] flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/30">
              <IconGenerate className="w-7 h-7 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">快速创建</h2>
            <p className="text-[#9ca3af] text-sm leading-relaxed mb-8">
              只需一句话描述您的想法，AI将自动生成完整的小说设定、大纲和初稿
            </p>
            
            <ul className="space-y-4 mb-10 flex-1">
              {[
                '30秒快速生成',
                '自动生成标题、简介、人设',
                '智能创建章节大纲和初稿'
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#22c55e]/10 flex items-center justify-center mt-0.5">
                    <IconCheck className="w-3 h-3 text-[#22c55e]" />
                  </div>
                  <span className="text-[#e2e8f0] text-sm">{item}</span>
                </li>
              ))}
            </ul>
            
            <button 
              onClick={handleQuickCreate}
              className="w-full flex items-center justify-center h-[56px] rounded-xl bg-gradient-to-r from-[#6366f1] to-[#9333ea] text-white font-semibold text-base hover:opacity-90 transition-opacity shadow-lg shadow-indigo-500/25"
            >
              选择快速创建
            </button>
          </div>

          {/* Advanced Create Card */}
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-3xl p-10 flex flex-col group hover:border-[#6366f1]/50 transition-all">
            
            <div className="w-14 h-14 rounded-2xl bg-[#ec4899] flex items-center justify-center mb-6 shadow-lg shadow-pink-500/30">
              <SlidersHorizontal className="w-7 h-7 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-white mb-4">高级创建</h2>
            <p className="text-[#9ca3af] text-sm leading-relaxed mb-8">
              详细设置小说的各项参数，包括标题、类型、简介、角色、世界观等
            </p>
            
            <ul className="space-y-4 mb-10 flex-1">
              {[
                '完全自定义控制',
                '详细设定角色和世界观',
                '精准把控创作方向'
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#a855f7]/10 flex items-center justify-center mt-0.5">
                    <IconCheck className="w-3 h-3 text-[#a855f7]" />
                  </div>
                  <span className="text-[#e2e8f0] text-sm">{item}</span>
                </li>
              ))}
            </ul>
            
            <button 
              onClick={handleAdvancedCreate}
              className="w-full h-[56px] rounded-xl bg-[#1e293b] border border-[#334155] text-white font-semibold text-base hover:bg-[#334155] transition-colors"
            >
              选择高级创建
            </button>
          </div>

        </div>
      </div>

    </div>
  )
}
