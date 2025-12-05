'use client'

import Link from 'next/link'
import Image from 'next/image'
import { 
  IconGenerate, 
  IconWriting, 
  IconSettings, 
  IconTemplates, 
  IconCheck, 
  IconPlay, 
  IconSparkles, 
  IconRegister, 
  IconLogin,
} from '../components/icons'
import { useAuth } from '@/lib/auth-context'
import { showAlert } from '@/lib/swal'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()

  const handleEnterEditor = () => {
    if (isAuthenticated) {
      router.push('/create')
    } else {
      router.push('/login?redirect=/create')
    }
  }

  return (
    <div className="bg-[#020617] text-white overflow-x-hidden font-sans">
        {/* Hero Section */}
        <section className="relative pt-[88px] pb-[140px] overflow-hidden">
          {/* Background Glows */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#6366f1] opacity-[0.05] blur-[120px] rounded-full" />
            <div className="absolute top-[20%] right-[0%] w-[40%] h-[40%] bg-[#9333ea] opacity-[0.05] blur-[120px] rounded-full" />
          </div>

          <div className="max-w-[1280px] mx-auto px-4 sm:px-8 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Content */}
              <div className="space-y-8">
                <h1 className="text-[72px] leading-[72px] font-bold tracking-[-0.032em] text-[#e5e7eb]">
                  一句话开启创作<br />之旅
                </h1>
                <p className="text-[18px] leading-[30px] text-[#9ca3af] max-w-[552px]">
                  NovAI 不仅仅是一个写作工具，更是你的灵感缪斯。利用最先进的大语言模型，为你构建宏大世界观，塑造立体人物，续写精彩剧情。
                </p>
                
                <div className="flex flex-wrap gap-4 pt-4">
                  <Link 
                    href={isAuthenticated ? "/create" : "/register"}
                    className="flex items-center justify-center gap-2 bg-[#6366f1] hover:bg-[#5558e6] text-white w-[162px] h-[58px] rounded-xl font-semibold text-base transition-all shadow-lg shadow-indigo-500/25"
                  >
                    <IconSparkles className="w-5 h-5" />
                    开始创作
                  </Link>
                  <button 
                    onClick={() => showAlert("演示功能开发中")}
                    className="flex items-center justify-center gap-2 bg-[#0f172a] border border-[#1e293b] hover:border-[#6366f1]/50 text-white w-[162px] h-[58px] rounded-xl font-medium text-base transition-all"
                  >
                    <IconPlay className="w-4 h-4 fill-current" />
                    观看演示
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-8 pt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
                       <IconCheck className="w-3 h-3 text-[#6366f1]" />
                    </div>
                    <span className="text-[#9ca3af] text-sm">免费试用</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
                       <IconCheck className="w-3 h-3 text-[#6366f1]" />
                    </div>
                    <span className="text-[#9ca3af] text-sm">无需信用卡</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-500/20 flex items-center justify-center">
                       <IconCheck className="w-3 h-3 text-[#6366f1]" />
                    </div>
                    <span className="text-[#9ca3af] text-sm">2000+ 作者好评</span>
                  </div>
                </div>
              </div>

              {/* Right Illustration */}
              <div className="relative flex justify-center lg:justify-end">
                <div className="relative w-[552px] h-[600px] rounded-[24px] overflow-hidden">
                   <Image 
                     src="/assets/home/hero-illustration.png"
                     alt="NovAI Hero Illustration"
                     fill
                     className="object-cover"
                     priority
                   />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-[96px] bg-[#020617] relative">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-8">
            <div className="text-center mb-[64px] space-y-4">
              <h2 className="text-[48px] leading-[48px] font-bold text-white">平台核心功能展示</h2>
              <p className="text-[18px] leading-[30px] text-[#9ca3af]">全流程 AI 辅助，打破创作瓶颈，让想象力自由驰骋。</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: "一键生成小说",
                  desc: ["一句话即可生成设定、人物、世界观与第一章草稿。", "快速验证创意，无需从零开始。"],
                  icon: IconGenerate,
                  color: "text-blue-500",
                  bg: "bg-blue-500/10",
                  borderColor: "hover:border-blue-500/30"
                },
                {
                  title: "AI 长篇写作引擎",
                  desc: ["自动生成 2000-4000 字章节。", "支持续写、润色、多版本生成，保持文风一致。"],
                  icon: IconWriting,
                  color: "text-purple-500",
                  bg: "bg-purple-500/10",
                  borderColor: "hover:border-purple-500/30"
                },
                {
                  title: "完整设定系统",
                  desc: ["人物卡、世界观体系、大纲结构化呈现。", "AI 自动维护一致性，避免吃书。"],
                  icon: IconSettings,
                  color: "text-pink-500",
                  bg: "bg-pink-500/10",
                  borderColor: "hover:border-pink-500/30"
                },
                {
                  title: "多题材模板支持",
                  desc: ["玄幻、仙侠、都市、二次元、科幻、悬疑等。", "针对不同题材优化模型表现。"],
                  icon: IconTemplates,
                  color: "text-cyan-500",
                  bg: "bg-cyan-500/10",
                  borderColor: "hover:border-cyan-500/30"
                }
              ].map((feature, i) => (
                <div key={i} className={`bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 min-h-[254px] transition-all duration-300 ${feature.borderColor} group relative overflow-hidden`}>
                   {/* Background Accent */}
                   <div className={`absolute top-0 right-0 w-32 h-32 ${feature.bg} opacity-5 rounded-bl-full -mr-10 -mt-10 pointer-events-none`} />
                   
                  <div className={`w-14 h-14 rounded-xl ${feature.bg} flex items-center justify-center mb-6`}>
                    <feature.icon className={`w-7 h-7 ${feature.color}`} />
                  </div>
                  <h3 className="text-[20px] font-bold mb-4 text-white">{feature.title}</h3>
                  <div className="space-y-1 text-[#9ca3af] text-sm leading-[17px]">
                    {feature.desc.map((line, j) => <p key={j} className="mb-1">{line}</p>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Process Section */}
        <section className="py-[96px] relative overflow-hidden">
           {/* Gradient Background for Section */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0f172a]/30 to-transparent pointer-events-none" />
          
          <div className="max-w-[1280px] mx-auto px-4 sm:px-8 relative z-10">
            <div className="text-center mb-[64px] space-y-4">
              <h2 className="text-[48px] leading-[48px] font-bold text-white">创作流程展示</h2>
              <p className="text-[18px] leading-[28px] text-[#9ca3af]">简单三步，即可开启你的 AI 创作之旅</p>
            </div>

            {/* Timeline Line (Desktop) */}
            <div className="relative">
               <div className="hidden md:block absolute top-[24px] left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-transparent via-[#6366f1]/40 to-transparent z-0" />

              <div className="relative grid md:grid-cols-3 gap-8">
                {[
                  {
                    step: "1",
                    title: "输入一句话",
                    desc: "\"末日废土背景下，一个拥有净化能力的医生在流浪。\"",
                    active: false
                  },
                  {
                    step: "2",
                    title: "AI 自动生成设定",
                    desc: "系统自动扩充世界观、生成主要角色卡片、构建第一章大纲草稿。",
                    tag: "AI Processing...",
                    active: true
                  },
                  {
                    step: "3",
                    title: "开始创作",
                    desc: "进入沉浸式编辑器，生成下一章或续写内容，随时调整方向。",
                    action: "进入编辑器",
                    active: false,
                    isAction: true
                  }
                ].map((item, i) => (
                  <div key={i} className="relative bg-[#020617]/80 backdrop-blur-sm border border-[#1e293b] rounded-2xl p-8 min-h-[260px] flex flex-col shadow-lg">
                    {/* Step Number Circle */}
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-6 z-10 relative mx-auto md:mx-0
                      ${item.active 
                        ? 'bg-[#0f172a] border border-[#6366f1] text-[#6366f1]' 
                        : i === 2 
                          ? 'bg-[#0f172a] border border-[#6366f1] text-[#6366f1]' 
                          : 'bg-[#6366f1] text-white shadow-lg shadow-indigo-500/30'}`}>
                      {item.step}
                    </div>
                    
                    <h3 className="text-[18px] font-bold mb-3 text-white">{item.title}</h3>
                    <p className="text-[#9ca3af] text-sm leading-[20px] mb-4 flex-1">
                      {item.desc}
                    </p>
                    
                    {item.tag && (
                      <div className="flex items-center gap-2 text-xs text-[#9ca3af] mt-auto">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                        {item.tag}
                      </div>
                    )}
                    
                    {item.action && (
                      <button 
                        onClick={handleEnterEditor}
                        className="flex items-center gap-1 text-[#6366f1] text-sm font-medium cursor-pointer hover:underline mt-auto"
                      >
                        {item.action}
                        <IconLogin className="w-4 h-4" />
                      </button>
                    )}
                    
                    {/* Step 1 progress bar decoration */}
                    {i === 0 && (
                        <div className="w-12 h-1 bg-[#1e293b] rounded-full mt-auto"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="h-[462px] relative bg-[#0f172a] overflow-visible flex items-center justify-center">
           {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/10 via-transparent to-[#581c87]/10" />
          
          {/* Ambient Circle Glow - Positioned relative to the section based on Figma coordinates */}
          {/* Figma CTASection y=1829.5, Circle y=1637.5. Circle is ~192px ABOVE the section start. */}
          {/* Relative X: 360px (25% of 1440). W: 384, H: 384. */}
          <div className="absolute left-[25%] -top-[192px] w-[384px] h-[384px] bg-[#6366f1] opacity-20 rounded-full blur-[100px] pointer-events-none" />

          <div className="max-w-[896px] mx-auto px-4 text-center relative z-10 space-y-8">
            <div className="space-y-6">
              <h2 className="text-[48px] font-bold text-white leading-[59px] tracking-[0em]">
                 准备开始您的创作之旅了吗？
              </h2>
              <p className="text-[20px] font-normal text-[#9ca3af] leading-[28px] max-w-[800px] mx-auto">
                 加入 NovAI 小说平台，解锁 AI 辅助创作的无限潜能，让每一个灵感都落地生根。
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
              <Link 
                href="/register" 
                className="w-[184px] h-[60px] bg-[#6366f1] hover:bg-[#5558e6] text-white rounded-xl font-semibold text-[18px] transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                立即注册
                <IconRegister />
              </Link>
              <Link 
                href="/login" 
                className="w-[184px] h-[60px] border border-[#1e293b] bg-transparent hover:bg-[#1e293b]/50 text-white rounded-xl font-medium text-[18px] transition-all flex items-center justify-center gap-2"
              >
                立即登录
                <IconLogin />
              </Link>
            </div>
          </div>
        </section>
    </div>
  )
}
