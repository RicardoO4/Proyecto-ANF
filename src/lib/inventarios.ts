export interface ProductoInventario {
  id_producto?: number
  codigo: string
  nombre: string
  demanda_anual: number
  costo_unitario: number
  costo_pedido: number
  costo_mantenimiento_anual: number
  plazo_entrega_dias: number
  stock_seguridad: number
  dias_operacion: number
  existencias: number
}
export function validarProducto(producto: ProductoInventario): string[] {
  const errores: string[] = []
  if (typeof producto.codigo !== 'string' || !producto.codigo.trim() || producto.codigo.trim().length > 50) errores.push('Código requerido, máximo 50 caracteres.')
  if (typeof producto.nombre !== 'string' || !producto.nombre.trim() || producto.nombre.trim().length > 150) errores.push('Nombre requerido, máximo 150 caracteres.')
  for (const key of ['demanda_anual', 'costo_unitario', 'costo_pedido', 'costo_mantenimiento_anual', 'plazo_entrega_dias', 'stock_seguridad', 'dias_operacion', 'existencias'] as const) {
    if (typeof producto[key] !== 'number' || !Number.isFinite(producto[key]) || producto[key] < 0) errores.push(`${key}: ingrese un número no negativo.`)
  }
  if (!(producto.costo_mantenimiento_anual > 0)) errores.push('El costo de mantenimiento por unidad y año debe ser mayor que cero.')
  if (!Number.isInteger(producto.dias_operacion) || producto.dias_operacion < 1 || producto.dias_operacion > 366) errores.push('Días de operación: entero entre 1 y 366.')
  return errores
}
export function analizarInventarios(productos: ProductoInventario[]) {
  for (const p of productos) if (validarProducto(p).length) throw new Error('Producto inválido: ' + p.codigo)
  const ordenados = productos.map(p => ({ ...p, consumoAnual: p.demanda_anual * p.costo_unitario })).sort((a, b) => b.consumoAnual - a.consumoAnual || a.codigo.localeCompare(b.codigo))
  const total = ordenados.reduce((s, p) => s + p.consumoAnual, 0)
  let acumulado = 0
  return ordenados.map(p => {
    const porcentaje = total > 0 ? p.consumoAnual / total * 100 : 0
    // El artículo que cruza el umbral permanece en la clase de origen.
    const clase = porcentaje === 0 ? 'C' : acumulado < 80 ? 'A' : acumulado < 95 ? 'B' : 'C'
    acumulado += porcentaje
    const eoq = Math.sqrt(2 * p.demanda_anual * p.costo_pedido / p.costo_mantenimiento_anual)
    const puntoReorden = p.demanda_anual / p.dias_operacion * p.plazo_entrega_dias + p.stock_seguridad
    return { ...p, porcentaje, acumulado, clase, eoq, puntoReorden, pedir: p.demanda_anual > 0 && p.existencias <= puntoReorden, pedidosAnuales: eoq > 0 ? p.demanda_anual / eoq : null }
  })
}
