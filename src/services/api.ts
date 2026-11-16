// Axios client for /api/v1 — attaches the session token when available.
import axios from 'axios'
import { readSession, expireSession } from '@/services/session'

export { TOKEN_KEY } from '@/services/session'

export const apiClient = axios.create({
  baseURL: '/api/v1',
})

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const session = readSession()
    if (session) {
      config.headers.Authorization = `Bearer ${session.token}`
    } else {
      expireSession()
      throw new Error('Tu sesión terminó. Inicia sesión nuevamente.')
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) expireSession()
    return Promise.reject(error)
  },
)

/** Extracts the backend error message from an axios error. */
export function getErrorMessage(err: unknown, fallback = 'Ocurrió un error.'): string {
  const e = err as { response?: { data?: { message?: string } } }
  return e?.response?.data?.message || fallback
}
