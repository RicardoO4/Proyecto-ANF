// usuarioService — CRUD over /api/v1/usuarios
import { apiClient, getErrorMessage } from './api'
import type { UsuarioResponseDTO } from '@/types'

export const usuarioService = {
  async getUsuarios(): Promise<UsuarioResponseDTO[]> {
    const resp = await apiClient.get<UsuarioResponseDTO[]>('/usuarios')
    return resp.data
  },
  async getUsuarioById(id: number): Promise<UsuarioResponseDTO> {
    const resp = await apiClient.get<UsuarioResponseDTO>(`/usuarios/${id}`)
    return resp.data
  },
  async createUsuario(data: Partial<UsuarioResponseDTO> & { contrasena?: string | null }): Promise<UsuarioResponseDTO> {
    const resp = await apiClient.post<UsuarioResponseDTO>('/usuarios', data)
    return resp.data
  },
  async updateUsuario(id: number, data: Partial<UsuarioResponseDTO> & { contrasena?: string | null }): Promise<UsuarioResponseDTO> {
    const resp = await apiClient.put<UsuarioResponseDTO>(`/usuarios/${id}`, data)
    return resp.data
  },
  async deleteUsuario(id: number): Promise<void> {
    await apiClient.delete(`/usuarios/${id}`)
  },
  async getAccesos(id: number): Promise<{ accesos: number[] }> {
    const resp = await apiClient.get(`/usuarios/${id}/accesos`)
    return resp.data as { accesos: number[] }
  },
  async updateAccesos(id: number, accesos: number[]): Promise<{ accesos: number[] }> {
    const resp = await apiClient.put(`/usuarios/${id}/accesos`, { accesos })
    return resp.data as { accesos: number[] }
  },
}

export { getErrorMessage }
