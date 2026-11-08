import type { LoginResponse } from '@/types'

export const TOKEN_KEY = 'analisis_token'
const USER_KEY = 'analisis_user'
const ACTIVITY_KEY = 'analisis_last_activity'
export const SESSION_EXPIRED_EVENT = 'analisis:session-expired'
export const SESSION_IDLE_MS = 60 * 60 * 1000

export type UserSession = Omit<LoginResponse, 'token'>

// Solo controla la caducidad en el navegador; no verifica la firma del JWT.
function tokenExpiresAt(token: string): number {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown }
    return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : 0
  } catch {
    return 0
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  sessionStorage.removeItem(ACTIVITY_KEY)
}

export function readSession(): { token: string; user: UserSession } | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const rawUser = sessionStorage.getItem(USER_KEY)
    if (!token || !rawUser || tokenExpiresAt(token) <= Date.now()) return null
    const user = JSON.parse(rawUser) as Partial<UserSession> | null
    if (
      !user || typeof user.userName !== 'string' || typeof user.rol !== 'string' ||
      typeof user.id !== 'number' || !Number.isFinite(user.id) ||
      !Array.isArray(user.accesos) || !user.accesos.every(Number.isFinite)
    ) return null

    const activity = sessionStorage.getItem(ACTIVITY_KEY)
    // Compatibilidad con sesiones creadas antes de añadir el límite de inactividad.
    const lastActivity = activity === null ? Date.now() : Number(activity)
    if (!Number.isFinite(lastActivity) || Date.now() - lastActivity >= SESSION_IDLE_MS) return null
    if (activity === null) sessionStorage.setItem(ACTIVITY_KEY, String(lastActivity))
    return { token, user: user as UserSession }
  } catch {
    return null
  }
}

export function saveSession(data: LoginResponse): UserSession {
  if (tokenExpiresAt(data.token) <= Date.now()) throw new Error('La sesión recibida ya venció.')
  const user: UserSession = {
    userName: data.userName, rol: data.rol, id: data.id, accesos: data.accesos,
  }
  sessionStorage.setItem(TOKEN_KEY, data.token)
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
  sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  return user
}

export function touchSession(): void {
  sessionStorage.setItem(ACTIVITY_KEY, String(Date.now()))
}

export function expireSession(): void {
  clearSession()
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}
