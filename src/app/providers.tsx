'use client'

// Providers — global client wrappers (AuthProvider + MUI theme + toast Toaster).
import type { ReactNode } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/context/AuthContext'
import MuiFeyProvider from './MuiFeyProvider'

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <MuiFeyProvider>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              background: '#191919',
              color: '#ffffff',
              border: '1px solid #262626',
              borderRadius: '12px',
              fontSize: '13px',
              boxShadow: 'rgba(0, 0, 0, 0.8) 0 0 44px 0',
            },
            success: {
              iconTheme: { primary: '#4ebe96', secondary: '#0b0b0b' },
            },
            error: {
              style: { border: '1px solid rgba(224, 108, 90, 0.5)' },
              iconTheme: { primary: '#e06c5a', secondary: '#ffffff' },
            },
            loading: {
              iconTheme: { primary: '#479ffa', secondary: '#0b0b0b' },
            },
          }}
        />
      </AuthProvider>
    </MuiFeyProvider>
  )
}
