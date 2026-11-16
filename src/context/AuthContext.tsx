'use client'

// AuthContext — same contract as the original:
//   token in sessionStorage('analisis_token')
//   user: { userName, rol, id, accesos: number[] }
//   login(userName, contrasena) / logout()
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authService } from '@/services/auth'
import type { LoginResponse } from '@/types'
import {
  clearSession, readSession, saveSession, touchSession, SESSION_EXPIRED_EVENT,
  type UserSession,
} from '@/services/session'

interface AuthContextType {
  isAuthenticated: boolean
  isRestoring: boolean
  user: UserSession | null
  login: (userName: string, contrasena: string) => Promise<LoginResponse>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isRestoring, setIsRestoring] = useState(true)
  const [user, setUser] = useState<UserSession | null>(null)
  const isAuthenticated = user !== null

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
  }, [])

  // El guard espera esta restauración antes de decidir si redirige al login.
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => {
      if (!active) return
      const session = readSession()
      if (!session) clearSession()
      setUser(session?.user ?? null)
      setIsRestoring(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout)
  }, [logout])

  useEffect(() => {
    if (!isAuthenticated) return
    let lastWrite = 0
    const checkSession = () => {
      if (!readSession()) logout()
    }
    const onActivity = () => {
      if (document.visibilityState === 'hidden') return
      const now = Date.now()
      if (now - lastWrite < 1000) return
      lastWrite = now
      // Comprobar antes de renovar: una pestaña abandonada no revive al volver.
      if (!readSession()) {
        logout()
        return
      }
      touchSession()
    }
    const interval = window.setInterval(checkSession, 30_000)
    const events = ['pointerdown', 'keydown', 'scroll'] as const
    events.forEach((event) => window.addEventListener(event, onActivity, { passive: true }))
    window.addEventListener('focus', checkSession)
    document.addEventListener('visibilitychange', checkSession)
    return () => {
      window.clearInterval(interval)
      events.forEach((event) => window.removeEventListener(event, onActivity))
      window.removeEventListener('focus', checkSession)
      document.removeEventListener('visibilitychange', checkSession)
    }
  }, [isAuthenticated, logout])

  const login = async (userName: string, contrasena: string): Promise<LoginResponse> => {
    const data = await authService.login(userName, contrasena)
    setUser(saveSession(data))
    return data
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, isRestoring, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider')
  return ctx
}
