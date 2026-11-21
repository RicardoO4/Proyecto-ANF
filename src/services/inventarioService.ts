import { apiClient } from './api'
import type { ItemABC, ItemEOQ, ItemReorden } from '@/lib/inventarioFormulas'

export interface ProductoInventario {
  idProducto: number
  codigoSku: string
  nombre: string
  descripcion: string | null
  costoUnitario: number
  stockActual: number
  activo: boolean
  empresaId: number
}

export interface ProductoInput {
  empresaId: number
  codigoSku?: string
  nombre: string
  descripcion?: string | null
  costoUnitario: number
  stockActual: number
  activo?: boolean
}

export interface MovimientoInventario {
  idMovimiento: number
  productoId: number
  empresaId: number
  tipoMovimiento: 'ENTRADA' | 'SALIDA'
  cantidad: number
  fecha: string
  observacion: string | null
  codigoSku?: string
  nombreProducto?: string
}

export interface MovimientoInput {
  empresaId: number
  productoId: number
  tipoMovimiento: 'ENTRADA' | 'SALIDA'
  cantidad: number
  fecha: string
  observacion?: string | null
}

export interface ParametroInventario {
  empresaId: number
  costoPedido: number
  tasaMantenimiento: number
  leadTimeDias: number
  diasAnio: number
  corteA: number
  corteB: number
}

export interface ModelosInventarioResponse {
  anio: number
  aniosDisponibles: number[]
  supuestos: ParametroInventario
  abc: ItemABC[]
  eoq: ItemEOQ[]
  reorden: ItemReorden[]
}

export const inventarioService = {
  async getProductos(empresaId: number): Promise<ProductoInventario[]> {
    const resp = await apiClient.get<ProductoInventario[]>('/inventario/productos', {
      params: { empresaId },
    })
    return resp.data
  },

  async createProducto(payload: ProductoInput): Promise<ProductoInventario> {
    const resp = await apiClient.post<ProductoInventario>('/inventario/productos', payload)
    return resp.data
  },

  async updateProducto(id: number, payload: ProductoInput): Promise<ProductoInventario> {
    const resp = await apiClient.put<ProductoInventario>(`/inventario/productos/${id}`, {
      ...payload,
      idProducto: id,
    })
    return resp.data
  },

  async deleteProducto(id: number, empresaId: number): Promise<void> {
    await apiClient.delete(`/inventario/productos/${id}`, { params: { empresaId } })
  },

  async getMovimientos(empresaId: number): Promise<MovimientoInventario[]> {
    const resp = await apiClient.get<MovimientoInventario[]>('/inventario/movimientos', {
      params: { empresaId },
    })
    return resp.data
  },

  async createMovimiento(payload: MovimientoInput): Promise<MovimientoInventario> {
    const resp = await apiClient.post<MovimientoInventario>('/inventario/movimientos', payload)
    return resp.data
  },

  async deleteMovimiento(id: number, empresaId: number): Promise<void> {
    await apiClient.delete(`/inventario/movimientos/${id}`, { params: { empresaId } })
  },

  async getParametros(empresaId: number): Promise<ParametroInventario | null> {
    const resp = await apiClient.get<ParametroInventario | null>('/inventario/parametros', {
      params: { empresaId },
    })
    return resp.data
  },

  async saveParametros(payload: ParametroInventario): Promise<ParametroInventario> {
    const resp = await apiClient.put<ParametroInventario>('/inventario/parametros', payload)
    return resp.data
  },

  async getModelos(empresaId: number, anio: number): Promise<ModelosInventarioResponse> {
    const resp = await apiClient.get<ModelosInventarioResponse>('/inventario/modelos', {
      params: { empresaId, anio },
    })
    return resp.data
  },
}
