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
  tieneDemanda: boolean
  supuestos: ParametroInventario
  abc: ItemABC[]
  eoq: ItemEOQ[]
  reorden: ItemReorden[]
}

export interface VentaInventario {
  idVenta: number
  idDetalle: number
  productoId: number
  empresaId: number
  codigoSku?: string
  nombreProducto?: string
  fechaVenta: string
  anio: number
  cantidad: number
  precioUnitario: number
  subtotal: number
  observacion: string | null
}

export interface VentaInventarioInput {
  empresaId: number
  productoId: number
  anio: number
  cantidad: number
  precioVentaUnitario: number
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

  async getModelos(empresaId: number, anio: number | null): Promise<ModelosInventarioResponse> {
    const resp = await apiClient.get<ModelosInventarioResponse>('/inventario/modelos', {
      params: { empresaId, ...(anio === null ? {} : { anio }) },
    })
    return resp.data
  },

  async getVentas(empresaId: number, anio?: number | null): Promise<VentaInventario[]> {
    const resp = await apiClient.get<VentaInventario[]>('/inventario/ventas', {
      params: { empresaId, ...(anio == null ? {} : { anio }) },
    })
    return resp.data
  },

  async getPrecioVentaSugerido(empresaId: number, productoId: number): Promise<number | null> {
    const resp = await apiClient.get<{ precioVentaUnitario: number | null }>('/inventario/ventas/precio-sugerido', {
      params: { empresaId, productoId },
    })
    return resp.data.precioVentaUnitario
  },

  async createVenta(payload: VentaInventarioInput): Promise<VentaInventario> {
    const resp = await apiClient.post<VentaInventario>('/inventario/ventas', payload)
    return resp.data
  },

  async deleteVenta(id: number, empresaId: number): Promise<void> {
    await apiClient.delete(`/inventario/ventas/${id}`, { params: { empresaId } })
  },
}
