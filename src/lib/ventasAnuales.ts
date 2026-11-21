import { describirPeriodo, type PeriodoContableFinanciero } from './periodoFinanciero'
import { esVentaAnual } from './ventasMensuales'
import type { VentaRow } from '@/types'

export function seleccionarVentasCompletas(ventas: VentaRow[], periodos: PeriodoContableFinanciero[], anioActual = new Date().getFullYear()) {
  const anios = [...new Set(ventas.map(v => Number(v.fecha_venta.slice(0, 4))))].sort((a,b) => a-b)
  const excluidos = anios.flatMap(anio => {
    if (!describirPeriodo(anio, periodos.find(p => p.anio === anio), anioActual).completo) return [{anio, motivo:'Ejercicio provisional'}]
    const filas = ventas.filter(v => Number(v.fecha_venta.slice(0,4)) === anio)
    if (!filas.some(v => esVentaAnual(v.observacion)) && new Set(filas.map(v => v.fecha_venta.slice(5,7))).size !== 12) return [{anio, motivo:'Faltan meses del año'}]
    return []
  })
  const omitidos = new Set(excluidos.map(f => f.anio))
  return { ventas: ventas.filter(v => !omitidos.has(Number(v.fecha_venta.slice(0,4)))), excluidos }
}
