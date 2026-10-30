// Axios client for /api/v1 — attaches the session token when available.
import axios from 'axios'

export const TOKEN_KEY = 'analisis_token'

export const apiClient = axios.create({
  baseURL: '/api/v1',
})

apiClient.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? sessionStorage.getItem(TOKEN_KEY) : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Extracts the backend error message from an axios error. */
export function getErrorMessage(err: unknown, fallback = 'Ocurrió un error.'): string {
  const e = err as { response?: { data?: { message?: string } } }
  return e?.response?.data?.message || fallback
}
