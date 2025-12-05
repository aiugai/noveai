import { 
  Zap, 
  BookOpen, 
  Layers, 
  Layout, 
  Check, 
  Play, 
  ChevronRight, 
  Sparkles as LucideSparkles,
  Search,
  Plus,
  Edit2,
  Trash2,
  Heart,
  Filter
} from 'lucide-react'

// 导出图标组件，方便您替换为 Figma 中的 SVG 代码

// 1. 核心功能图标
export const IconGenerate = ({ className }: { className?: string }) => (
  <Zap className={className} />
)

export const IconWriting = ({ className }: { className?: string }) => (
  <BookOpen className={className} />
)

export const IconSettings = ({ className }: { className?: string }) => (
  <Layers className={className} />
)

export const IconTemplates = ({ className }: { className?: string }) => (
  <Layout className={className} />
)

// 2. 通用UI图标
export const IconCheck = ({ className }: { className?: string }) => (
  <Check className={className} />
)

export const IconPlay = ({ className }: { className?: string }) => (
  <Play className={className} />
)

export const IconArrowRight = ({ className }: { className?: string }) => (
  <ChevronRight className={className} />
)

export const IconSearch = ({ className }: { className?: string }) => (
  <Search className={className} />
)

export const IconPlus = ({ className }: { className?: string }) => (
  <Plus className={className} />
)

export const IconEdit = ({ className }: { className?: string }) => (
  <Edit2 className={className} />
)

export const IconTrash = ({ className }: { className?: string }) => (
  <Trash2 className={className} />
)

export const IconHeart = ({ className }: { className?: string }) => (
  <Heart className={className} />
)

export const IconFilter = ({ className }: { className?: string }) => (
  <Filter className={className} />
)

// 3. 插画/装饰图标
export const IconSparkles = ({ className }: { className?: string }) => (
  <LucideSparkles className={className} />
)

// 4. CTA按钮图标 (您提到的注册/登录按钮图标)
export const IconRegister = ({ className }: { className?: string }) => {
  return (
    // 注册按钮图标 (魔杖/闪光)
    <svg width="21" height="18" viewBox="0 0 21 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M13.5 4.5L10.5 1.5L7.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.5 1.5V10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3.5 10.5V13.5C3.5 14.2956 3.81607 15.0587 4.37868 15.6213C4.94129 16.1839 5.70435 16.5 6.5 16.5H14.5C15.2956 16.5 16.0587 16.1839 16.6213 15.6213C17.1839 15.0587 17.5 14.2956 17.5 13.5V10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export const IconLogin = ({ className }: { className?: string }) => {
  return (
    // 登录按钮图标 (进入/箭头)
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M11.25 3.75L16.5 9L11.25 14.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.5 9H1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export const IconGoogle = ({ className }: { className?: string }) => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M15.25 8.15909C15.25 7.59659 15.2 7.05114 15.1068 6.52273H8.15909V9.38068H12.1364C11.9636 10.3125 11.4318 11.108 10.6364 11.642V13.5227H13.025C14.4227 12.2364 15.25 10.3409 15.25 8.15909Z" fill="#FFFFFF"/>
      <path d="M8.15909 15.3864C10.1523 15.3864 11.825 14.7273 13.0273 13.6193L10.6386 11.7386C9.97727 12.1818 9.13182 12.4432 8.16136 12.4432C6.23864 12.4432 4.61136 11.1443 4.02955 9.39432H1.56136V11.3068C2.73864 13.6443 5.275 15.3864 8.15909 15.3864Z" fill="#FFFFFF"/>
      <path d="M4.02727 9.39432C3.87727 8.94432 3.79545 8.46591 3.79545 7.97386C3.79545 7.48182 3.87727 7.00341 4.02727 6.55341V4.64091H1.56136C1.05227 5.65341 0.763636 6.78409 0.763636 7.97386C0.763636 9.16364 1.05227 10.2943 1.56136 11.3068L4.02727 9.39432Z" fill="#FFFFFF"/>
      <path d="M8.15909 3.50341C9.24318 3.50341 10.2136 3.87614 10.9795 4.60682L13.0795 2.50682C11.8227 1.33523 10.1523 0.613636 8.15909 0.613636C5.275 0.613636 2.73864 2.35568 1.56136 4.69318L4.02727 6.60568C4.61136 4.85568 6.23864 3.50341 8.15909 3.50341Z" fill="#FFFFFF"/>
    </svg>
  )
}

export const IconGithub = ({ className }: { className?: string }) => {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M8 0.666626C3.58 0.666626 0 4.24663 0 8.66663C0 12.2016 2.29 15.1966 5.47 16.2566C5.87 16.3316 6.015 16.0816 6.015 15.8716C6.015 15.6866 6.005 15.0616 6.005 14.3966C4 14.7666 3.47 13.7466 3.345 13.3916C3.275 13.2116 2.97 12.6566 2.7 12.5066C2.48 12.3866 2.165 12.0916 2.695 12.0816C3.195 12.0716 3.55 12.5416 3.67 12.7316C4.24 13.6916 5.145 13.4166 5.505 13.2516C5.56 12.8416 5.725 12.5616 5.905 12.4016C4.11 12.1966 2.225 11.5066 2.225 8.41163C2.225 7.53163 2.535 6.81663 3.05 6.25163C2.965 6.04663 2.685 5.22163 3.13 4.10663C3.13 4.10663 3.805 3.89163 5.34 4.93163C5.98 4.75163 6.67 4.66163 7.35 4.65663C8.03 4.66163 8.72 4.75163 9.36 4.93163C10.895 3.89163 11.57 4.10663 11.57 4.10663C12.015 5.22163 11.735 6.04663 11.65 6.25163C12.165 6.81663 12.475 7.53163 12.475 8.41163C12.475 11.5166 10.585 12.1916 8.785 12.3916C9.015 12.5916 9.22 12.9816 9.22 13.5866C9.22 14.4516 9.21 15.1566 9.21 15.3716C9.21 15.5866 9.36 15.8416 9.77 15.7616C12.945 14.6966 15.235 11.7016 15.235 8.16663C15.235 3.74663 11.655 0.666626 7.235 0.666626H8Z" fill="#FFFFFF"/>
    </svg>
  )
}

// 5. Logo
export const LogoIcon = ({ className }: { className?: string }) => {
  return (
    <svg 
      viewBox="0 0 74 74" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <g filter="url(#filter0_dd_1_477)">
        <path d="M15 17C15 10.3726 20.3726 5 27 5H47C53.6274 5 59 10.3726 59 17V37C59 43.6274 53.6274 49 47 49H27C20.3726 49 15 43.6274 15 37V17Z" fill="url(#paint0_linear_1_477)"/>
        <g clipPath="url(#clip0_1_477)">
          <path d="M37.8789 24.9219L27.8984 34.8984C27.5312 35.2656 27.5312 35.8594 27.8984 36.2226C28.2656 36.5859 28.8594 36.5898 29.2227 36.2226L32.1445 33.3008C32.4336 33.4805 32.7422 33.6211 33.0742 33.7109C34.8242 34.1875 37.5469 34.2539 40.2031 32.4922C40.6797 32.1758 40.4297 31.5 39.8594 31.5H39.2305C39.0312 31.5 38.8711 31.3398 38.8711 31.1406C38.8711 30.9805 38.9766 30.8437 39.125 30.7969L42.9414 29.6523C43.0742 29.6133 43.1914 29.5312 43.2695 29.4141C43.4414 29.1641 43.6055 28.9101 43.7617 28.6484C44.0039 28.2461 43.7031 27.75 43.2344 27.75H41.7266C41.5273 27.75 41.3672 27.5898 41.3672 27.3906C41.3672 27.2305 41.4727 27.0937 41.6211 27.0469L44.7812 26.0976C44.9609 26.043 45.1094 25.9101 45.1797 25.7344C46.3164 22.8672 46.8359 19.8633 46.9961 17.9375C47.0273 17.5508 46.8789 17.1719 46.6055 16.8984C46.332 16.625 45.9531 16.4766 45.5664 16.5078C42.293 16.7734 35.9258 18.082 32.3672 21.6406C29.2383 24.7695 29.2148 28.3086 29.7852 30.4219C29.8672 30.7305 30.2539 30.7969 30.4805 30.5703L36.9062 24.1484C37.1484 23.9062 37.5469 23.9062 37.7891 24.1484C38 24.3594 38.0273 24.6797 37.875 24.9219H37.8789Z" fill="white"/>
        </g>
      </g>
      <defs>
        <filter id="filter0_dd_1_477" x="0" y="0" width="74" height="74" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dy="10"/>
          <feGaussianBlur stdDeviation="7.5"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0.388235 0 0 0 0 0.4 0 0 0 0 0.945098 0 0 0 0.3 0"/>
          <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_1_477"/>
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
          <feOffset dy="4"/>
          <feGaussianBlur stdDeviation="3"/>
          <feColorMatrix type="matrix" values="0 0 0 0 0.388235 0 0 0 0 0.4 0 0 0 0 0.945098 0 0 0 0.3 0"/>
          <feBlend mode="normal" in2="effect1_dropShadow_1_477" result="effect2_dropShadow_1_477"/>
          <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_1_477" result="shape"/>
        </filter>
        <linearGradient id="paint0_linear_1_477" x1="-0.556349" y1="20.5563" x2="30.5563" y2="51.669" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1"/>
          <stop offset="1" stopColor="#9333EA"/>
        </linearGradient>
        <clipPath id="clip0_1_477">
          <path d="M27 16.5H47V36.5H27V16.5Z" fill="white"/>
        </clipPath>
      </defs>
    </svg>
  )
}

// 6. Payment Methods
export const IconAlipay = ({ className }: { className?: string }) => {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <path d="M4.71 12.545a16.958 16.958 0 0 0 1.238 1.786c.422.52.87 1.016 1.342 1.486.472.47 1.002.9 1.587 1.285a17.06 17.06 0 0 0 2.658 1.328c-.922.367-1.87.663-2.836.885a17.67 17.67 0 0 1-3.015.355H.062c.276-1.122.73-2.19 1.346-3.16.42-.663.915-1.28 1.472-1.84.558-.56 1.184-1.052 1.865-1.466.31-.19.63-.366.96-.526Zm8.36 3.78c.572-.38 1.102-.81 1.583-1.285.48-.47.928-.97 1.342-1.49a16.75 16.75 0 0 0 1.23-1.787c.325.16.647.337.963.53.68.413 1.306.906 1.864 1.466.557.56 1.052 1.18 1.47 1.84.618.97 1.07 2.038 1.345 3.16h-5.632a17.68 17.68 0 0 1-3.007-.35c-.962-.22-1.905-.516-2.82-.882.215-.128.433-.26.654-.403Zm.55-6.733h-3.27V7.776h7.33c.186.963.53 1.89.998 2.75.15.273.312.54.487.798H24v1.81h-4.97c-.376.98-.868 1.913-1.458 2.78a15.31 15.31 0 0 1-2.088 2.43c.772.27 1.565.482 2.37.63 1.02.19 2.06.29 3.08.29h3.01v1.75h-3.01a17.76 17.76 0 0 1-3.48-.34 19.2 19.2 0 0 1-3.36-1.03c-.587.366-1.2.69-1.83.966a18.97 18.97 0 0 1-2.95.93A19.54 19.54 0 0 1 6 21.59a19.5 19.5 0 0 1-3.32-.28V19.56c1.023 0 2.06-.1 3.08-.29.808-.15 1.602-.36 2.372-.63.76-.272 1.475-.62 2.13-1.036.657-.416 1.26-.9 1.797-1.44.536-.54 1.01-1.13 1.41-1.756.4-.63.733-1.3.993-2 0-.005 0-.01.005-.016H0v-1.81h9.62c-.176-.26-.34-.527-.49-.8-.467-.86-.81-1.786-1.016-2.75H4.65V7.776h3.27V4.22h1.96v3.557h3.74Z" />
    </svg>
  )
}

export const IconWechat = ({ className }: { className?: string }) => {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <path d="M8.69 13.616c0 2.964 2.635 5.366 5.887 5.366 3.252 0 5.887-2.402 5.887-5.366 0-2.964-2.635-5.367-5.887-5.367-3.252 0-5.887 2.403-5.887 5.367Zm12.664 2.478c0-2.426-2.357-4.393-5.265-4.393-2.908 0-5.266 1.967-5.266 4.393 0 2.425 2.358 4.392 5.266 4.392.66 0 1.292-.127 1.88-.352l1.355.706-.375-1.208c1.45-1.003 2.405-2.293 2.405-3.538Zm-1.73-7.76c0 3.69-3.53 6.68-7.883 6.68-.46 0-.912-.034-1.35-.102-1.075.72-2.41 1.15-3.847 1.15-.32 0-.634-.02-.942-.063-3.32-.45-5.843-3.31-5.843-6.76C-.242 5.55 3.288 2.56 7.642 2.56s7.882 2.99 7.882 6.68Z" />
    </svg>
  )
}
