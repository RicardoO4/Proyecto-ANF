export const ESCALA_C4 = 2

export type ClaseABC = 'A' | 'B' | 'C'

export interface ProductoDemanda {
  id: number | string
  codigoSku: string
  nombre: string
  demandaAnual: number
  costoUnitario: number
  stockActual: number
}

export interface ItemABC extends ProductoDemanda {
  valorAnual: number
  porcentaje: number
  acumulado: number
  clase: ClaseABC
}

export interface ItemEOQ extends ProductoDemanda {
  costoMantenimiento: number
  loteEconomico: number
  pedidosAnuales: number
}

export interface ItemReorden extends ProductoDemanda {
  consumoDiario: number
  leadTimeDias: number
  puntoReorden: number
  reposicionSugerida: number
}

export function redondearInventario(valor: number, escala: number = ESCALA_C4): number {
  const factor = Math.pow(10, escala)
  return Math.round((valor + Number.EPSILON) * factor) / factor
}

export function valorAnual(demandaAnual: number, costoUnitario: number): number {
  return redondearInventario(demandaAnual * costoUnitario)
}

export function clasificacionABC(
  productos: ProductoDemanda[],
  corteA: number = 0.8,
  corteB: number = 0.95,
): ItemABC[] {
  const items = productos.map((producto) => ({
    ...producto,
    valorAnual: valorAnual(producto.demandaAnual, producto.costoUnitario),
  }))

  const total = items.reduce((suma, item) => suma + Math.max(0, item.valorAnual), 0)
  const ordenados = [...items].sort((a, b) => {
    if (b.valorAnual !== a.valorAnual) return b.valorAnual - a.valorAnual
    return a.codigoSku.localeCompare(b.codigoSku, 'es')
  })

  let acumulado = 0
  const porCodigo = new Map<string, ItemABC>()

  for (const item of ordenados) {
    acumulado += Math.max(0, item.valorAnual)
    const fraccion = total === 0 ? 0 : acumulado / total
    const clase: ClaseABC =
      total === 0 ? 'C' : fraccion <= corteA ? 'A' : fraccion <= corteB ? 'B' : 'C'
    porCodigo.set(item.codigoSku, {
      ...item,
      porcentaje: total === 0 ? 0 : redondearInventario((item.valorAnual / total) * 100),
      acumulado: total === 0 ? 0 : redondearInventario(fraccion * 100),
      clase,
    })
  }

  return items.map((item) => porCodigo.get(item.codigoSku) as ItemABC)
}

export function loteEconomico(
  demandaAnual: number,
  costoPedido: number,
  tasaMantenimiento: number,
  costoUnitario: number,
): number {
  const costoMantenimiento = tasaMantenimiento * costoUnitario
  if (demandaAnual <= 0 || costoPedido <= 0 || costoMantenimiento <= 0) return 0
  return redondearInventario(Math.sqrt((2 * demandaAnual * costoPedido) / costoMantenimiento))
}

export function pedidosAnuales(demandaAnual: number, eoq: number): number {
  if (eoq <= 0 || demandaAnual <= 0) return 0
  return redondearInventario(demandaAnual / eoq)
}

export function consumoDiario(demandaAnual: number, diasAnio: number = 365): number {
  if (diasAnio <= 0 || demandaAnual <= 0) return 0
  return redondearInventario(demandaAnual / diasAnio)
}

export function puntoReorden(
  demandaAnual: number,
  leadTimeDias: number,
  diasAnio: number = 365,
): number {
  if (leadTimeDias <= 0 || diasAnio <= 0 || demandaAnual <= 0) return 0
  return redondearInventario((demandaAnual / diasAnio) * leadTimeDias)
}

export function reposicionSugerida(puntoReordenValor: number, stockActual: number): number {
  return redondearInventario(Math.max(0, puntoReordenValor - stockActual))
}

export function calcularEOQ(
  productos: ProductoDemanda[],
  costoPedido: number,
  tasaMantenimiento: number,
): ItemEOQ[] {
  return productos.map((producto) => {
    const eoq = loteEconomico(
      producto.demandaAnual,
      costoPedido,
      tasaMantenimiento,
      producto.costoUnitario,
    )
    return {
      ...producto,
      costoMantenimiento: redondearInventario(tasaMantenimiento * producto.costoUnitario),
      loteEconomico: eoq,
      pedidosAnuales: pedidosAnuales(producto.demandaAnual, eoq),
    }
  })
}

export function calcularReorden(
  productos: ProductoDemanda[],
  leadTimeDias: number,
  diasAnio: number = 365,
): ItemReorden[] {
  return productos.map((producto) => {
    const pr = puntoReorden(producto.demandaAnual, leadTimeDias, diasAnio)
    return {
      ...producto,
      consumoDiario: consumoDiario(producto.demandaAnual, diasAnio),
      leadTimeDias,
      puntoReorden: pr,
      reposicionSugerida: reposicionSugerida(pr, producto.stockActual),
    }
  })
}
