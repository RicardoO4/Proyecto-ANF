import { ValidationException } from '@/lib/errors'
import type {
  MovimientoInventario,
  ParametroInventario,
  ProductoInventario,
} from '@/services/inventarioService'

export function leerEmpresaId(valor: unknown): number {
  const empresaId = Number(valor)
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new ValidationException('empresaId: El identificador de empresa es obligatorio')
  }
  return empresaId
}

export function productoDTO(row: Record<string, unknown>): ProductoInventario {
  return {
    idProducto: Number(row.id_producto),
    codigoSku: String(row.codigo_sku),
    nombre: String(row.nombre),
    descripcion: row.descripcion == null ? null : String(row.descripcion),
    costoUnitario: Number(row.costo_unitario),
    stockActual: Number(row.stock_actual),
    activo: Boolean(row.activo),
    empresaId: Number(row.empresa_id),
  }
}

export function movimientoDTO(row: Record<string, unknown>): MovimientoInventario {
  const producto = row.producto as Record<string, unknown> | null
  const codigoSku = row.codigo_sku ?? producto?.codigo_sku
  const nombreProducto = row.nombre ?? producto?.nombre
  return {
    idMovimiento: Number(row.id_movimiento),
    productoId: Number(row.producto_id),
    empresaId: Number(row.empresa_id),
    tipoMovimiento: row.tipo_movimiento as 'ENTRADA' | 'SALIDA',
    cantidad: Number(row.cantidad),
    fecha: String(row.fecha),
    observacion: row.observacion == null ? null : String(row.observacion),
    codigoSku: codigoSku == null ? undefined : String(codigoSku),
    nombreProducto: nombreProducto == null ? undefined : String(nombreProducto),
  }
}

export function parametroDTO(row: Record<string, unknown>): ParametroInventario {
  return {
    empresaId: Number(row.empresa_id),
    costoPedido: Number(row.costo_pedido),
    tasaMantenimiento: Number(row.tasa_mantenimiento),
    leadTimeDias: Number(row.lead_time_dias),
    diasAnio: Number(row.dias_anio),
    corteA: Number(row.corte_a),
    corteB: Number(row.corte_b),
  }
}

export function parametrosPorDefecto(empresaId: number): ParametroInventario {
  return {
    empresaId,
    costoPedido: 0,
    tasaMantenimiento: 0,
    leadTimeDias: 0,
    diasAnio: 365,
    corteA: 0.8,
    corteB: 0.95,
  }
}
