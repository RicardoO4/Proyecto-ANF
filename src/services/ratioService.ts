// ratioService — CRUD + the 9 calculator endpoints + select datasets
import { apiClient } from './api'
import type { RatioResponseDTO, CategoriaRatioResponseDTO, ParametroSectorResponseDTO } from '@/types'

export interface TipoRatioData {
  id_tipo_ratio: number
  codigo_ratio: string | null
  nombre_ratio: string
  descripcion: string | null
  unidad_ratio: string | null
}

export interface CategoriaRatioData {
  idCategoriaRatio: number
  nombreTipo: string
  descripcion: string | null
  idTipoRatio: number
}

export interface ParametroSectorData {
  nombreRatio: string
  valorReferencia: number
  fuente?: string | null
  anioReferencia?: number | null
  id_sector: number
  id_categoria_ratio: number
}

export interface RatioSaveData {
  anio_ratio: number
  periodo_ratio: string
  valor_calculado?: number
  empresa_id: number
  id_categoria_ratio?: number
  id_parametro_sector?: number
}

export const ratioService = {
  async getRatios(nombreEmpresa?: string): Promise<RatioResponseDTO[]> {
    const resp = await apiClient.get<RatioResponseDTO[]>('/ratios', {
      params: nombreEmpresa ? { nombreEmpresa } : undefined,
    })
    return resp.data
  },
  async createRatio(data: RatioSaveData): Promise<RatioResponseDTO> {
    const resp = await apiClient.post<RatioResponseDTO>('/ratios', data)
    return resp.data
  },
  async updateRatio(id: number, data: Partial<RatioSaveData>): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}`, data)
    return resp.data
  },
  async deleteRatio(id: number): Promise<void> {
    await apiClient.delete(`/ratios/${id}`)
  },
  async calculateLiquidezRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-liquidez`)
    return resp.data
  },
  async calculateCapitalTrabajoRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-capital-trabajo`)
    return resp.data
  },
  async calculateEfectivoRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-efectivo`)
    return resp.data
  },
  async calculateRotacionCuentasPorCobrarRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-rotacion-cuentas-cobrar`)
    return resp.data
  },
  async calculatePeriodoCobranzaRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-periodo-cobranza`)
    return resp.data
  },
  async calculateRotacionActivosTotalesRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-rotacion-activos-totales`)
    return resp.data
  },
  async calculateRotacionActivosFijosRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-rotacion-activos-fijos`)
    return resp.data
  },
  async calculateMargenBrutoRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-margen-bruto`)
    return resp.data
  },
  async calculateMargenOperativoRatio(id: number): Promise<RatioResponseDTO> {
    const resp = await apiClient.put<RatioResponseDTO>(`/ratios/${id}/calcular-margen-operativo`)
    return resp.data
  },
}

export const tiposRatio = {
  async getTiposRatio(): Promise<TipoRatioData[]> {
    const resp = await apiClient.get<TipoRatioData[]>('/tipos-ratio')
    return resp.data
  },
  async getTipoRatioById(id: number): Promise<TipoRatioData> {
    const resp = await apiClient.get<TipoRatioData>(`/tipos-ratio/${id}`)
    return resp.data
  },
  async createTipoRatio(data: Omit<TipoRatioData, 'id_tipo_ratio'> & { id_categoria_ratio?: number }): Promise<TipoRatioData> {
    const resp = await apiClient.post<TipoRatioData>('/tipos-ratio', data)
    return resp.data
  },
  async updateTipoRatio(id: number, data: Partial<TipoRatioData>): Promise<TipoRatioData> {
    const resp = await apiClient.put<TipoRatioData>(`/tipos-ratio/${id}`, data)
    return resp.data
  },
  async deleteTipoRatio(id: number): Promise<void> {
    await apiClient.delete(`/tipos-ratio/${id}`)
  },
}

export const categoriasRatio = {
  async getCategoriasRatio(): Promise<CategoriaRatioData[]> {
    const resp = await apiClient.get<CategoriaRatioData[]>('/categorias-ratio')
    return resp.data
  },
  async createCategoriaRatio(data: { nombreTipo: string; descripcion?: string | null; idTipoRatio: number }): Promise<CategoriaRatioData> {
    const resp = await apiClient.post<CategoriaRatioData>('/categorias-ratio', data)
    return resp.data
  },
  async updateCategoriaRatio(id: number, data: Partial<{ nombreTipo: string; descripcion?: string | null; idTipoRatio: number }>): Promise<CategoriaRatioData> {
    const resp = await apiClient.put<CategoriaRatioData>(`/categorias-ratio/${id}`, data)
    return resp.data
  },
  async deleteCategoriaRatio(id: number): Promise<void> {
    await apiClient.delete(`/categorias-ratio/${id}`)
  },
}

export const parametroSectorService = {
  async getParametros(): Promise<ParametroSectorResponseDTO[]> {
    const resp = await apiClient.get<ParametroSectorResponseDTO[]>('/parametros-sector')
    return resp.data
  },
  async getParametroById(id: number): Promise<ParametroSectorResponseDTO> {
    const resp = await apiClient.get<ParametroSectorResponseDTO>(`/parametros-sector/${id}`)
    return resp.data
  },
  async createParametro(data: ParametroSectorData): Promise<ParametroSectorResponseDTO> {
    const resp = await apiClient.post<ParametroSectorResponseDTO>('/parametros-sector', data)
    return resp.data
  },
  async updateParametro(id: number, data: Partial<ParametroSectorData>): Promise<ParametroSectorResponseDTO> {
    const resp = await apiClient.put<ParametroSectorResponseDTO>(`/parametros-sector/${id}`, data)
    return resp.data
  },
  async deleteParametro(id: number): Promise<void> {
    await apiClient.delete(`/parametros-sector/${id}`)
  },
}
