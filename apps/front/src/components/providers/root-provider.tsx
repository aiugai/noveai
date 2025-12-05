'use client'

import { AuthProvider } from '@/lib/auth-context'

export function RootProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  )
}

