import type { BaseFinanciera } from './baseFinanciera'
import { sumByPrefix } from './accountCodes'
import { gradoEndeudamiento, liquidezCorriente, margenNeto, roa } from './ratioFormulas'

export interface PeriodoDashboard { anio: number; origen: string; estado: string; version: number; version_publicada: number | null }
export type EstadoDashboard = 'HISTORICO' | 'FINAL' | 'PROVISIONAL' | 'IMPORTADO'

export function resumirDashboard(base: BaseFinanciera, periodo?: PeriodoDashboard) {
  const tieneBalance = base.tieneBalance && base.balance.length > 0
  const tieneResultados = base.tieneResultados && base.resultados.length > 0
  const estado: EstadoDashboard = !periodo ? 'IMPORTADO' : periodo.origen === 'HISTORICO' ? 'HISTORICO' : periodo.estado === 'CERRADO' ? 'FINAL' : 'PROVISIONAL'
  const saldos = new Map(base.balance.map(linea => [linea.codigo, linea]))
  const pasivoCorriente = sumByPrefix(saldos, '21')
  return {
    anio: base.anio, estado, tieneBalance, tieneResultados,
    cambiosPendientes: periodo?.origen === 'CONTABILIDAD' && periodo.version !== periodo.version_publicada,
    ventas: tieneResultados ? base.ventas : null,
    ingresos: tieneResultados ? base.ingresos : null,
    costosGastos: tieneResultados ? base.costosGastos : null,
    utilidad: tieneResultados ? base.utilidad : null,
    activos: tieneBalance ? base.activos : null,
    pasivos: tieneBalance ? base.pasivos : null,
    patrimonio: tieneBalance ? base.patrimonio : null,
    efectivo: tieneBalance ? base.efectivo : null,
    endeudamiento: tieneBalance && base.activos > 0 ? gradoEndeudamiento(base.pasivos, base.activos) : null,
    liquidez: tieneBalance && pasivoCorriente !== 0 ? liquidezCorriente(sumByPrefix(saldos, '11'), pasivoCorriente) : null,
    margen: tieneResultados && base.ventas > 0 ? margenNeto(base.utilidad, base.ventas) : null,
    rentabilidad: tieneBalance && tieneResultados && base.activoPromedio > 0 ? roa(base.utilidad, base.activoPromedio) : null,
    diferenciaBalance: tieneBalance ? Math.round((base.activos - base.pasivos - base.patrimonio) * 100) / 100 : null,
  }
}

export type ResumenDashboard = ReturnType<typeof resumirDashboard>
export interface DashboardFinanciero {
  empresa: { empresaId: number; nombreEmpresa: string }
  anios: number[]
  seleccionado: ResumenDashboard | null
  anterior: ResumenDashboard | null
  historico: ResumenDashboard[]
}

export function compararDashboard(actual: number | null, anterior: number | null, comparable: boolean, porcentaje = false): { valor: number; unidad: 'porcentaje' | 'moneda' | 'puntos' } | null {
  if (!comparable || actual === null || anterior === null) return null
  if (porcentaje) return { valor: (actual - anterior) * 100, unidad: 'puntos' }
  if (anterior > 0 && actual >= 0) return { valor: (actual - anterior) / anterior * 100, unidad: 'porcentaje' }
  return { valor: actual - anterior, unidad: 'moneda' }
}
