import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-4xl font-bold mb-4">404 - 页面未找到</h2>
      <p className="text-[#9ca3af] mb-8">抱歉，您访问的页面不存在。</p>
      <Link 
        href="/"
        className="px-6 py-3 bg-[#6366f1] hover:bg-[#5558e6] rounded-xl text-white font-semibold transition-colors"
      >
        返回首页
      </Link>
    </div>
  )
}

