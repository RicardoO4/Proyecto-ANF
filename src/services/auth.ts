// authService — POST /api/auth/login (fetch like the original service).
// Expected response: { token, userName, rol, id, accesos: number[] }
import type { LoginResponse } from '@/types'

export const authService = {
  async login(userName: string, contrasena: string): Promise<LoginResponse> {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName, contrasena }),
    })
    let parsed: Partial<LoginResponse> & { message?: string } = {}
    try {
      parsed = (await resp.json()) as Partial<LoginResponse> & { message?: string }
    } catch {
      /* empty body */
    }
    if (!resp.ok) {
      throw new Error(parsed.message || 'Credenciales incorrectas')
    }
    if (!parsed.token) {
      throw new Error('Credenciales incorrectas')
    }
    return parsed as LoginResponse
  },
}
