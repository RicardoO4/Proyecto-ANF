'use client'

// Providers — global client wrappers (AuthProvider + react-hot-toast Toaster),
// mirroring the original main.jsx / AppRouter composition.
import type { ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--color-darkest)',
            color: 'var(--text-light)',
            border: '1px solid var(--color-primary)',
          },
          success: {
            iconTheme: { primary: 'var(--color-accent)', secondary: '#FFF' },
          },
          error: {
            style: { border: '1px solid #D32F2F' },
            iconTheme: { primary: '#D32F2F', secondary: '#FFF' },
          },
        }}
      />
    </AuthProvider>
  )
}
