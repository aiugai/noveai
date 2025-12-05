import { LogoIcon } from './icons'

export function Footer() {
  return (
    <footer className="bg-[#0b1021] border-t border-white/5 py-[60px]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-8 text-center space-y-8">
        <div className="flex items-center justify-center gap-2">
           <div className="w-[50px] h-[50px] flex items-center justify-center translate-y-1.5">
             <LogoIcon className="w-full h-full" />
           </div>
           <span className="text-2xl font-bold text-white tracking-widest">NovAI</span>
        </div>
        
        <p className="text-[#9ca3af] text-[16px] font-light tracking-[0.025em]">让 AI 成为您创作路上的最佳伙伴</p>
        
        <div className="space-y-2 text-[12px] text-[#9ca3af]/50 font-light pt-4">
          <p>© 2025 NovAI. 保留所有权利.</p>
          <p>官方邮箱: support@novai.app</p>
        </div>
      </div>
    </footer>
  )
}

