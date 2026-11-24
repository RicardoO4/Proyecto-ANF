import { BusinessRuleException, NotFoundException, ValidationException } from '@/lib/errors'
import type {
  MovimientoInventario,
  ParametroInventario,
  ProductoInventario,
  VentaInventario,
} from '@/services/inventarioService'

export function leerEmpresaId(valor: unknown): number {
  const empresaId = Number(valor)
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    throw new ValidationException('empresaId: El identificador de empresa es obligatorio')
  }
  return empresaId
}

export async function leerCuerpoInventario(req: Request): Promise<Record<string, unknown>> {
  let body: unknown
  try { body = await req.json() } catch { throw new ValidationException('El cuerpo debe ser un objeto JSON válido.') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationException('El cuerpo debe ser un objeto JSON válido.')
  return body as Record<string, unknown>
}

export function validarProductoInventario(body: Record<string, unknown>, empresaId: number) {
  if (typeof body.codigoSku !== 'string' || !body.codigoSku.trim()) throw new ValidationException('codigoSku: El SKU es obligatorio.')
  if (typeof body.nombre !== 'string' || !body.nombre.trim()) throw new ValidationException('nombre: El nombre es obligatorio.')
  const costo = Number(body.costoUnitario), stock = Number(body.stockActual)
  if (!['number', 'string'].includes(typeof body.costoUnitario) || !['number', 'string'].includes(typeof body.stockActual)) throw new ValidationException('Costo y stock deben ser importes numéricos.')
  if (body.costoUnitario == null || body.costoUnitario === '' || !Number.isFinite(costo) || costo < 0) throw new ValidationException('costoUnitario: Debe ser un número finito mayor o igual a cero.')
  if (body.stockActual == null || body.stockActual === '' || !Number.isInteger(stock) || stock < 0 || stock > 2147483647) throw new ValidationException('stockActual: Debe ser un entero entre 0 y 2147483647.')
  if (body.descripcion != null && typeof body.descripcion !== 'string') throw new ValidationException('descripcion: Debe ser texto.')
  if (body.activo != null && typeof body.activo !== 'boolean') throw new ValidationException('activo: Debe ser verdadero o falso.')
  return { empresa_id: empresaId, codigo_sku: body.codigoSku.trim(), nombre: body.nombre.trim(), descripcion: body.descripcion ?? null, costo_unitario: costo, stock_actual: stock, activo: body.activo ?? true }
}

export function errorMovimientoInventario(error: { code?: string; message?: string }): never {
  if (error.code === 'P0002') throw new NotFoundException(error.message ?? 'Registro no encontrado.')
  if (error.code === '22023' || error.code === '22007' || error.code === '22008') throw new ValidationException(error.message ?? 'Datos inválidos del movimiento.')
  if (error.code === 'PGRST202' || error.code === '42883') throw new BusinessRuleException('Falta aplicar la migración corregir_integridad_inventario en Supabase. No se guardó ningún movimiento.')
  throw error
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

export function ventaInventarioDTO(row: Record<string, unknown>): VentaInventario {
  const producto = row.producto as Record<string, unknown> | null
  const venta = row.venta as Record<string, unknown> | null
  const codigoSku = row.codigo_sku ?? producto?.codigo_sku
  const nombreProducto = row.nombre ?? producto?.nombre
  const fechaVenta = String(row.fecha_venta ?? venta?.fecha_venta ?? '')
  const observacion = row.observacion ?? venta?.observacion
  return {
    idVenta: Number(row.venta_id ?? venta?.id_venta),
    idDetalle: Number(row.id_detalle),
    productoId: Number(row.producto_id),
    empresaId: Number(row.empresa_id),
    codigoSku: codigoSku == null ? undefined : String(codigoSku),
    nombreProducto: nombreProducto == null ? undefined : String(nombreProducto),
    fechaVenta,
    anio: Number(fechaVenta.slice(0, 4)),
    cantidad: Number(row.cantidad),
    precioUnitario: Number(row.precio_unitario),
    subtotal: Number(row.subtotal),
    observacion: observacion == null ? null : String(observacion),
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
