import './globals.css'
import type { Metadata } from 'next'
import { RootProvider } from '@/components/providers/root-provider'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

export const metadata: Metadata = {
  title: 'NovAI - AI 写作助手',
  description: 'AI 驱动的小说创作平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-[#020617] text-white font-sans">
        <RootProvider>
          <Header />
          <main className="pt-[82px] min-h-screen">
            {children}
          </main>
          <Footer />
        </RootProvider>
      </body>
    </html>
  )
}
