// estadoFinancieroService — Excel upload, list, detail, delete, years
import { apiClient, getErrorMessage } from './api'
import type { EstadoFinancieroResponseDTO, LineaEstadoFinancieroResponseDTO } from '@/types'

export type EstadoFinancieroListItem = {
  id: number
  anio: number
  tipoReporte: string
  empresaId: number
  nombreEmpresa: string
}

export type EstadoFinancieroDetail = {
  id: number
  anio: number
  tipoReporte: string
  empresaId: number
  nombreEmpresa: string
  lineas: LineaEstadoFinancieroResponseDTO[]
}

export const estadoFinancieroService = {
  async uploadEstadoFinanciero(file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    await apiClient.post('/estados-financieros/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  async getAllEstadosFinancieros(): Promise<EstadoFinancieroResponseDTO[]> {
    const resp = await apiClient.get('/estados-financieros')
    return resp.data
  },
  async getEstadoFinancieroById(id: number): Promise<EstadoFinancieroDetail> {
    const resp = await apiClient.get(`/estados-financieros/${id}`)
    return resp.data
  },
  async deleteEstadoFinanciero(id: number): Promise<void> {
    await apiClient.delete(`/estados-financieros/${id}`)
  },
  async getAniosByEmpresa(empresaId: number): Promise<number[]> {
    const resp = await apiClient.get<number[]>(`/estados-financieros/anios/${empresaId}`)
    return resp.data
  },
}

export { getErrorMessage }
