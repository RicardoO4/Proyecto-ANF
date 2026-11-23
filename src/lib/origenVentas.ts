import type { VentaRow } from '@/types'
import { describirPeriodo, type PeriodoContableFinanciero } from './periodoFinanciero'
import { MARCA_VENTA_ANUAL } from './ventasMensuales'

const MARCA_DETALLE_SKU = /^INV \d{4} /

type VentaBasica = Pick<VentaRow, 'fecha_venta' | 'observacion'>
type VentaConId = Pick<VentaRow, 'id_venta' | 'fecha_venta' | 'observacion'>

export type OrigenVenta = 'ANUAL_CONTABLE' | 'MENSUAL_REAL' | 'DETALLE_SKU'

export function anioVenta(venta: Pick<VentaRow, 'fecha_venta'>): number {
  return Number(String(venta.fecha_venta).slice(0, 4))
}

export function esVentaContableAnual(venta: { observacion?: string | null }): boolean {
  return Boolean(venta.observacion?.startsWith(MARCA_VENTA_ANUAL))
}

export function esVentaDetalleSku(venta: { observacion?: string | null }): boolean {
  return MARCA_DETALLE_SKU.test(venta.observacion ?? '')
}

export function origenVenta(venta: VentaBasica): OrigenVenta {
  if (esVentaContableAnual(venta)) return 'ANUAL_CONTABLE'
  if (esVentaDetalleSku(venta)) return 'DETALLE_SKU'
  return 'MENSUAL_REAL'
}

export function seleccionarVentasHistoricas(
  ventas: VentaRow[],
  periodos: PeriodoContableFinanciero[],
  anioActual = new Date().getFullYear(),
): { ventas: VentaRow[]; excluidos: { anio: number; motivo: string }[] } {
  ventas = ventas.filter((venta) => !esVentaDetalleSku(venta))
  const anios = [...new Set(ventas.map(anioVenta))].sort((a, b) => a - b)
  const excluidos = anios.flatMap((anio) => {
    const periodo = periodos.find((p) => p.anio === anio)
    if (!describirPeriodo(anio, periodo, anioActual).completo) {
      return [{ anio, motivo: 'Ejercicio provisional' }]
    }
    const filas = ventas.filter((venta) => anioVenta(venta) === anio)
    if (!filas.some(esVentaContableAnual) && new Set(filas.map((v) => v.fecha_venta.slice(5, 7))).size !== 12) {
      return [{ anio, motivo: 'Faltan meses del año' }]
    }
    return []
  })

  const aniosExcluidos = new Set(excluidos.map((e) => e.anio))
  const aniosConTotalContable = new Set(
    ventas.filter(esVentaContableAnual).map(anioVenta),
  )

  return {
    ventas: ventas.filter((venta) => {
      const anio = anioVenta(venta)
      if (aniosExcluidos.has(anio)) return false
      if (esVentaContableAnual(venta)) return true
      return !aniosConTotalContable.has(anio)
    }),
    excluidos,
  }
}

export function ventasRealesDelAnio<T extends VentaConId>(
  ventas: T[],
  anio: number,
): T[] {
  const filas = ventas.filter((venta) => anioVenta(venta) === anio)
  const concretas = filas.filter((venta) => !esVentaDetalleSku(venta))
  return concretas.length ? concretas : filas
}
