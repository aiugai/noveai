'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogoIcon } from './icons'
import { useAuth } from '@/lib/auth-context'

export function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  // 充值页不展示 Header
  if (pathname === '/recharge') {
    return null
  }

  const handleProtectedClick = (e: React.MouseEvent, href: string) => {
    if (!isAuthenticated) {
      e.preventDefault()
      router.push(`/login?redirect=${href}`)
    }
  }

  const showAppNav = isAuthenticated && pathname !== '/'

  return (
    <header
      data-role="app-header"
      className="fixed top-0 left-0 right-0 z-50 h-[82px] bg-[#0f172a]/70 backdrop-blur border-b border-[#6366f1]/15"
    >
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-full flex items-center justify-between">
        {/* Logo Area */}
        <Link href="/" className="flex items-center gap-2">
           <div className="w-[60px] h-[60px] flex items-center justify-center translate-y-2">
             <LogoIcon className="w-full h-full" />
           </div>
           <span className="text-2xl font-bold tracking-tight text-white">NovAI</span>
        </Link>

        {/* Navigation - Only shown when authenticated AND NOT on home page */}
        {showAppNav && (
          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors ${pathname === '/dashboard' ? 'text-white' : 'text-[#9ca3af] hover:text-white'}`}
            >
              个人中心
            </Link>
            <Link
              href="/novels"
              onClick={(e) => handleProtectedClick(e, '/novels')}
              className={`text-sm font-medium transition-colors ${pathname === '/novels' ? 'text-white' : 'text-[#9ca3af] hover:text-white'}`}
            >
              我的小说
            </Link>
            <Link
              href="/create"
              onClick={(e) => handleProtectedClick(e, '/create')}
              className={`text-sm font-medium transition-colors ${pathname?.startsWith('/create') ? 'text-white' : 'text-[#9ca3af] hover:text-white'}`}
            >
              新建小说
            </Link>
            <Link
              href="/recharge"
              onClick={(e) => handleProtectedClick(e, '/recharge')}
              className={`text-sm font-medium transition-colors ${pathname === '/recharge' ? 'text-white' : 'text-[#9ca3af] hover:text-white'}`}
            >
              充值中心
            </Link>
          </nav>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <>
              <Link href="/login" className="text-[#9ca3af] hover:text-white font-medium text-sm transition-colors">
                登录
              </Link>
              <Link
                href="/register"
                className="bg-[#6366f1] hover:bg-[#5558e6] text-white px-6 py-2.5 rounded-full font-semibold text-sm transition-all shadow-lg shadow-indigo-500/20"
              >
                开始创作
              </Link>
            </>
          ) : (
            <div className="relative group pb-2">
              <button
                onClick={() => router.push('/dashboard')}
                className="flex items-center gap-2 text-white hover:text-[#6366f1] transition-colors py-2"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-[#6366f1]/30" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#6366f1]/20 flex items-center justify-center text-[#6366f1] font-bold">
                    {user?.nickname?.[0] || 'U'}
                  </div>
                )}
                <span className="text-sm font-medium">{user?.nickname}</span>
              </button>

              {/* Dropdown */}
              <div className="absolute right-0 top-full pt-2 w-48 hidden group-hover:block">
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-xl overflow-hidden">
                  <Link href="/dashboard" className="block px-4 py-3 text-sm text-[#9ca3af] hover:text-white hover:bg-[#1e293b]">
                    个人中心
                  </Link>
                  <Link href="/settings/password" className="block px-4 py-3 text-sm text-[#9ca3af] hover:text-white hover:bg-[#1e293b]">
                    修改密码
                  </Link>
                  <Link href="/settings/security" className="block px-4 py-3 text-sm text-[#9ca3af] hover:text-white hover:bg-[#1e293b]">
                    安全设置
                  </Link>
                  <button
                    onClick={() => { logout(); router.push('/login'); }}
                    className="block w-full text-left px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-[#1e293b] border-t border-[#1e293b]"
                  >
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
