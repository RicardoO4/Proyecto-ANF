// empresaService — CRUD over /api/v1/empresas
import { apiClient } from './api'
import type { EmpresaResponseDTO } from '@/types'

export interface EmpresaData {
  nombreEmpresa: string
  empresaDui?: string | null
  empresaNit?: string | null
  empresaNrc?: string | null
  usuarioId?: number | null
  idSector?: number | null
}

export const empresaService = {
  async getEmpresas(): Promise<EmpresaResponseDTO[]> {
    const resp = await apiClient.get<EmpresaResponseDTO[]>('/empresas')
    return resp.data
  },
  async getEmpresaById(id: number): Promise<EmpresaResponseDTO> {
    const resp = await apiClient.get<EmpresaResponseDTO>(`/empresas/${id}`)
    return resp.data
  },
  async createEmpresa(data: EmpresaData): Promise<EmpresaResponseDTO> {
    const resp = await apiClient.post<EmpresaResponseDTO>('/empresas', data)
    return resp.data
  },
  async updateEmpresa(id: number, data: EmpresaData): Promise<EmpresaResponseDTO> {
    const resp = await apiClient.put<EmpresaResponseDTO>(`/empresas/${id}`, data)
    return resp.data
  },
  async deleteEmpresa(id: number): Promise<void> {
    await apiClient.delete(`/empresas/${id}`)
  },
}
