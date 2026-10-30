// sectorService — CRUD over /api/v1/sectores
import { apiClient } from './api'

export interface SectorData {
  nombreSector: string
  descripcion?: string | null
  paisReferencia?: string | null
  fuenteDatos?: string | null
}

export interface SectorResponse {
  idSector: number
  nombreSector: string
  descripcion: string | null
  paisReferencia: string | null
  fuenteDatos: string | null
}

export const sectorService = {
  async getSectores(): Promise<SectorResponse[]> {
    const resp = await apiClient.get<SectorResponse[]>('/sectores')
    return resp.data
  },
  async getSectorById(id: number): Promise<SectorResponse> {
    const resp = await apiClient.get<SectorResponse>(`/sectores/${id}`)
    return resp.data
  },
  async createSector(data: SectorData): Promise<SectorResponse> {
    const resp = await apiClient.post<SectorResponse>('/sectores', data)
    return resp.data
  },
  async updateSector(id: number, data: SectorData): Promise<SectorResponse> {
    const resp = await apiClient.put<SectorResponse>(`/sectores/${id}`, data)
    return resp.data
  },
  async deleteSector(id: number): Promise<void> {
    await apiClient.delete(`/sectores/${id}`)
  },
}
