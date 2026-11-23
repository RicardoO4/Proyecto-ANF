import type { PeriodoContableFinanciero } from './periodoFinanciero'
import { seleccionarVentasHistoricas } from './origenVentas'
import type { VentaRow } from '@/types'

export function seleccionarVentasCompletas(
  ventas: VentaRow[],
  periodos: PeriodoContableFinanciero[],
  anioActual = new Date().getFullYear(),
) {
  return seleccionarVentasHistoricas(ventas, periodos, anioActual)
}
