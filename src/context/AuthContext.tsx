'use client'

// AuthContext — same contract as the original:
//   token in sessionStorage('analisis_token')
//   user: { userName, rol, id, accesos: number[] }
//   login(userName, contrasena) / logout()
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { authService } from '@/services/auth'
import type { LoginResponse } from '@/types'

interface UserSession {
  userName: string
  rol: string
  id: number
  accesos: number[]
}

interface AuthContextType {
  isAuthenticated: boolean
  user: UserSession | null
  login: (userName: string, contrasena: string) => Promise<LoginResponse>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'analisis_token'
const USER_KEY = 'analisis_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<UserSession | null>(null)

  // restore the session (the original app didn't persist the user object;
  // we do persist it so the sidebar survives a page reload in Next.js,
  // but the token contract stays identical)
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const storedUser = sessionStorage.getItem(USER_KEY)
    if (token) setIsAuthenticated(true)
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as UserSession)
      } catch {
        setUser(null)
      }
    }
  }, [])

  const login = async (userName: string, contrasena: string): Promise<LoginResponse> => {
    const data = await authService.login(userName, contrasena)
    sessionStorage.setItem(TOKEN_KEY, data.token)
    sessionStorage.setItem(
      USER_KEY,
      JSON.stringify({ userName: data.userName, rol: data.rol, id: data.id, accesos: data.accesos }),
    )
    setUser({ userName: data.userName, rol: data.rol, id: data.id, accesos: data.accesos })
    setIsAuthenticated(true)
    return data
  }

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de un AuthProvider')
  return ctx
}
