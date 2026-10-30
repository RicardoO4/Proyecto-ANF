// ventaHistoricaService — ventas CRUD + projection + Excel upload
import { apiClient, getErrorMessage } from './api'
import type { ProyeccionDTO } from '@/types'

export interface VentaHistorica {
  id: number
  fechaVenta: string
  montoVenta: number
  observacion: string | null
  empresaId: number | null
}

export interface VentasManual {
  empresaId: number
  ventas: { fechaVenta: string; montoVenta: number; observacion?: string | null }[]
}

export const ventaHistoricaService = {
  async getProyeccionVentas(empresaId: number, meses: number, metodo: string): Promise<ProyeccionDTO[]> {
    const resp = await apiClient.get<ProyeccionDTO[]>(
      `/ventas-historicas/empresa/${empresaId}/proyeccion/${meses}`,
      { params: { metodo } },
    )
    return resp.data
  },
  async createVentasManual(payload: VentasManual): Promise<void> {
    await apiClient.post('/ventas-historicas', payload)
  },
  async uploadVentasExcel(file: File): Promise<void> {
    const formData = new FormData()
    formData.append('file', file)
    await apiClient.post('/ventas-historicas/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  async updateVenta(ventaId: number, data: { fechaVenta: string; montoVenta: number; observacion?: string | null }): Promise<VentaHistorica> {
    const resp = await apiClient.put<VentaHistorica>(`/ventas-historicas/${ventaId}`, data)
    return resp.data
  },
  async deleteVenta(ventaId: number): Promise<void> {
    await apiClient.delete(`/ventas-historicas/${ventaId}`)
  },
  async getAllVentasPorEmpresa(empresaId: number): Promise<VentaHistorica[]> {
    const resp = await apiClient.get<VentaHistorica[]>(`/ventas-historicas/empresa/${empresaId}`)
    return resp.data
  },
  async getVentasPorEmpresaYAnio(empresaId: number, anio: number): Promise<VentaHistorica[]> {
    const resp = await apiClient.get<VentaHistorica[]>(
      `/ventas-historicas/empresa/${empresaId}/anio/${anio}`,
    )
    return resp.data
  },
}

export { getErrorMessage }
