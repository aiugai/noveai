'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { IconSearch, IconPlus, IconEdit, IconTrash, IconHeart } from '@/components/icons'
import { ChevronDown, Check } from 'lucide-react'

import { AuthGuard } from '@/components/auth-guard'
import { mockListNovels, mockDeleteNovel, mockToggleFavorite, MockNovel } from '@/mock'
import { showAlert, showConfirm } from '@/lib/swal'

export default function MyNovelsPage() {
  return (
    <AuthGuard>
      <MyNovelsContent />
    </AuthGuard>
  )
}

function MyNovelsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ''
  const status = searchParams.get('status') || ''
  const isFavorite = searchParams.get('isFavorite') === 'true'
  
  const [novels, setNovels] = useState<MockNovel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(q)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  
  // Use ref for dropdown click outside
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    mockListNovels({ q, status: status === 'all' ? undefined : status, isFavorite })
      .then(data => {
        setNovels(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [q, status, isFavorite])

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const params = new URLSearchParams(searchParams.toString())
      if (searchInput) params.set('q', searchInput)
      else params.delete('q')
      router.push(`/novels?${params.toString()}`)
    }
  }

  const updateFilter = (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== 'all') params.set(key, value)
      else params.delete(key)
      router.push(`/novels?${params.toString()}`)
  }
  
  const handleDelete = async (id: string) => {
      if (await showConfirm("确定要删除这部小说吗？")) {
          try {
              await mockDeleteNovel(id)
              setNovels(prev => prev.filter(n => n.id !== id))
          } catch (_err) {
              showAlert("请求失败")
          }
      }
  }

  const toggleFavorite = async (id: string) => {
      try {
          const newState = await mockToggleFavorite(id);
          setNovels(prev => prev.map(n => n.id === id ? { ...n, isFavorite: newState } : n));
          // Refetch if we are in favorites tab to update list
          if (isFavorite) {
              setNovels(prev => prev.filter(n => n.id !== id))
          }
      } catch (_err) {
          showAlert("请求失败")
      }
  }

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'writing': return 'text-white bg-[#22c55e] border-transparent'
          case 'completed': return 'text-white bg-[#3b82f6] border-transparent'
          case 'dropped': return 'text-white bg-[#f97316] border-transparent'
          default: return 'text-gray-500 bg-gray-200'
      }
  }
  
  const getStatusLabel = (status: string) => {
      switch (status) {
          case 'writing': return '创作中'
          case 'completed': return '已完结'
          case 'dropped': return '已弃坑'
          default: return '全部状态'
      }
  }

  if (loading) {
      return <div className="flex justify-center items-center min-h-[500px] text-white">加载中...</div>
  }

  return (
    <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-8 py-8 space-y-8">
        {/* Hero Title Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-[48px] font-bold text-white">我的小说</h1>
            <p className="text-[#9ca3af] text-lg">管理您的所有创作作品</p>
          </div>
          <Link 
            href="/create"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#6366f1] to-[#9333ea] hover:opacity-90 text-white px-6 py-3.5 rounded-xl font-semibold text-base transition-all shadow-lg shadow-indigo-500/25 min-w-[154px]"
          >
            <IconPlus className="w-5 h-5" />
            新建小说
          </Link>
        </div>

        {/* Tabs for All / Favorites */}
        <div className="border-b border-[#1e293b] flex gap-8">
            <button 
                onClick={() => updateFilter('isFavorite', 'false')}
                className={`pb-4 text-sm font-medium transition-all relative ${!isFavorite ? 'text-white' : 'text-[#9ca3af] hover:text-white'}`}
            >
                全部作品
                {!isFavorite && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#6366f1]" />}
            </button>
            <button 
                onClick={() => updateFilter('isFavorite', 'true')}
                className={`pb-4 text-sm font-medium transition-all relative ${isFavorite ? 'text-white' : 'text-[#9ca3af] hover:text-white'}`}
            >
                我的收藏
                {isFavorite && <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#6366f1]" />}
            </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 flex flex-col lg:flex-row gap-4 items-center">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <IconSearch className="h-5 w-5 text-[#9ca3af]" />
            </div>
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="搜索小说标题... (按回车搜索)"
              className="w-full h-[50px] pl-11 pr-4 bg-[#020617] border border-[#1e293b] rounded-xl text-[#e5e7eb] placeholder-[#9ca3af] focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          {/* Status Filter Dropdown */}
          <div className="relative w-full lg:w-auto" ref={dropdownRef}>
            <button 
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full lg:w-[160px] flex items-center justify-between px-4 h-[50px] bg-[#020617] border border-[#1e293b] rounded-xl text-[#e5e7eb] hover:border-[#6366f1]/50 transition-all"
            >
              <span>{status ? getStatusLabel(status) : '全部状态'}</span>
              <ChevronDown className={`w-4 h-4 text-[#9ca3af] transition-transform ${showStatusDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showStatusDropdown && (
                <div className="absolute top-full right-0 mt-2 w-full lg:w-[160px] bg-[#0f172a] border border-[#1e293b] rounded-xl shadow-xl overflow-hidden z-20">
                    {['all', 'writing', 'completed', 'dropped'].map((opt) => (
                        <button
                            key={opt}
                            onClick={() => {
                                updateFilter('status', opt);
                                setShowStatusDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-[#9ca3af] hover:text-white hover:bg-[#1e293b] flex items-center justify-between"
                        >
                            {getStatusLabel(opt)}
                            {(status === opt || (!status && opt === 'all')) && <Check className="w-4 h-4 text-[#6366f1]" />}
                        </button>
                    ))}
                </div>
            )}
          </div>
        </div>

        {/* Novel List */}
        {novels.length === 0 ? (
            <div className="text-center py-20 bg-[#0f172a] border border-[#1e293b] rounded-2xl">
                <p className="text-[#9ca3af] mb-4">没有找到相关作品</p>
                {!isFavorite && <Link href="/create" className="text-[#6366f1] hover:underline">创建小说</Link>}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {novels.map((novel) => (
                <div key={novel.id} className="group bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden hover:border-[#6366f1]/50 transition-all shadow-sm hover:shadow-xl hover:shadow-indigo-500/10">
                {/* Cover Image Area */}
                <div 
                    className="relative h-[224px] w-full bg-[#020617] overflow-hidden cursor-pointer"
                    onClick={() => router.push(`/novel/writing?novelId=${novel.id}`)}
                >
                    <Image 
                    src={novel.coverUrl || "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?auto=format&fit=crop&q=80&w=800"} 
                    alt={novel.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* Status Badge */}
                    <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md ${getStatusColor(novel.status)}`}>
                        {getStatusLabel(novel.status)}
                    </div>
                </div>

                {/* Content Area */}
                <div className="p-6 space-y-4">
                    <div className="space-y-2 cursor-pointer" onClick={() => router.push(`/novel/writing?novelId=${novel.id}`)}>
                        <h3 className="text-xl font-bold text-white line-clamp-1 group-hover:text-[#6366f1] transition-colors">
                            {novel.title}
                        </h3>
                        <p className="text-[#9ca3af] text-sm leading-relaxed line-clamp-2 h-[40px]">
                            {novel.genre} - {novel.wordCount.toLocaleString()} 字
                        </p>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#1e293b]">
                        <div className="flex items-center gap-1.5 text-[#9ca3af] text-xs">
                            <span>{novel.updatedAt}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={() => router.push(`/novel/writing?novelId=${novel.id}`)}
                                className="p-2 text-[#9ca3af] hover:text-white hover:bg-[#1e293b] rounded-lg transition-colors" 
                                title="编辑"
                            >
                            <IconEdit className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => toggleFavorite(novel.id)}
                                className={`p-2 hover:bg-[#1e293b] rounded-lg transition-colors ${novel.isFavorite ? 'text-pink-500' : 'text-[#9ca3af] hover:text-pink-500'}`}
                                title={novel.isFavorite ? "取消收藏" : "收藏"}
                            >
                            <IconHeart className={`w-4 h-4 ${novel.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            <button 
                                onClick={() => handleDelete(novel.id)}
                                className="p-2 text-[#9ca3af] hover:text-red-500 hover:bg-[#1e293b] rounded-lg transition-colors" 
                                title="删除"
                            >
                            <IconTrash className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            ))}
            </div>
        )}
    </div>
  )
}
