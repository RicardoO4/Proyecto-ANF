import { sumByPrefix, TIPO_REPORTE, VENTAS_NETAS, INGRESOS_NETOS } from './accountCodes'
import { saldoPromedio, utilidadEjercicio } from './rentabilidad'
import type { PeriodoFinanciero } from './periodoFinanciero'

export type SaldosFinancieros = Map<string, { saldo: number; nombre: string }>
export interface EstadoDisponible { anio: number; tipo_reporte: string }

export function resumirBaseFinanciera(empresaId: number, seleccionado: number, estados: EstadoDisponible[], balance: SaldosFinancieros, resultados: SaldosFinancieros, anterior: SaldosFinancieros, periodo?: PeriodoFinanciero) {
  const anios = [...new Set(estados.map(estado => Number(estado.anio)))].sort((a, b) => b - a)
  const A = (prefijo: string) => sumByPrefix(balance, prefijo)
  const R = (prefijo: string | string[]) => sumByPrefix(resultados, prefijo)
  const tieneResultados = estados.some(estado => Number(estado.anio) === seleccionado && estado.tipo_reporte === TIPO_REPORTE.RESULTADOS)
  const tieneAnterior = estados.some(estado => Number(estado.anio) === seleccionado - 1 && estado.tipo_reporte === TIPO_REPORTE.BALANCE)
  return {
    empresaId, anio: seleccionado, anios, tieneResultados, periodo,
    tieneBalance: estados.some(estado => Number(estado.anio) === seleccionado && estado.tipo_reporte === TIPO_REPORTE.BALANCE),
    ventas: R(VENTAS_NETAS), ingresos: R(INGRESOS_NETOS), costosGastos: R('4'),
    utilidad: utilidadEjercicio(tieneResultados, R(INGRESOS_NETOS), R('4'), A('3204')),
    activos: A('1'), pasivos: A('2'), patrimonio: A('3'), efectivo: A('1101'),
    activoPromedio: saldoPromedio(A('1'), tieneAnterior ? sumByPrefix(anterior, '1') : null),
    patrimonioPromedio: saldoPromedio(A('3'), tieneAnterior ? sumByPrefix(anterior, '3') : null),
    balance: [...balance].map(([codigo, linea]) => ({ codigo, ...linea })),
    resultados: [...resultados].map(([codigo, linea]) => ({ codigo, ...linea })),
  }
}
