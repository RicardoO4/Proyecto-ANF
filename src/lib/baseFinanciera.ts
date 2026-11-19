import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSaldoMap } from '@/lib/analisis'
import { sumByPrefix, TIPO_REPORTE, VENTAS_NETAS, INGRESOS_NETOS } from '@/lib/accountCodes'
import { NotFoundException } from '@/lib/errors'
import { saldoPromedio, utilidadEjercicio } from '@/lib/rentabilidad'

export async function obtenerBaseFinanciera(empresaId: number, anio?: number) {
  const { data, error } = await supabaseAdmin.from('estado_financiero').select('anio, tipo_reporte').eq('empresa_id', empresaId).order('anio', { ascending: false })
  if (error) throw error
  const anios = [...new Set((data ?? []).map(r => Number(r.anio)))]
  const seleccionado = anio ?? anios[0]
  if (!seleccionado || !anios.includes(seleccionado)) throw new NotFoundException('No hay estados financieros para el año solicitado.')
  const [balance, resultados, anterior] = await Promise.all([
    getSaldoMap(empresaId, seleccionado, TIPO_REPORTE.BALANCE),
    getSaldoMap(empresaId, seleccionado, TIPO_REPORTE.RESULTADOS),
    getSaldoMap(empresaId, seleccionado - 1, TIPO_REPORTE.BALANCE),
  ])
  const A = (p: string) => sumByPrefix(balance, p)
  const R = (p: string | string[]) => sumByPrefix(resultados, p)
  const tieneResultados = (data ?? []).some(r => Number(r.anio) === seleccionado && r.tipo_reporte === TIPO_REPORTE.RESULTADOS)
  const tieneAnterior = (data ?? []).some(r => Number(r.anio) === seleccionado - 1 && r.tipo_reporte === TIPO_REPORTE.BALANCE)
  return {
    empresaId, anio: seleccionado, anios, tieneResultados,
    tieneBalance: (data ?? []).some(r => Number(r.anio) === seleccionado && r.tipo_reporte === TIPO_REPORTE.BALANCE),
    ventas: R(VENTAS_NETAS), ingresos: R(INGRESOS_NETOS), costosGastos: R('4'),
    utilidad: utilidadEjercicio(tieneResultados, R(INGRESOS_NETOS), R('4'), A('3204')),
    activos: A('1'), pasivos: A('2'), patrimonio: A('3'), efectivo: A('1101'),
    activoPromedio: saldoPromedio(A('1'), tieneAnterior ? sumByPrefix(anterior, '1') : null),
    patrimonioPromedio: saldoPromedio(A('3'), tieneAnterior ? sumByPrefix(anterior, '3') : null),
    balance: [...balance].map(([codigo, l]) => ({ codigo, ...l })),
    resultados: [...resultados].map(([codigo, l]) => ({ codigo, ...l })),

  }
}
export type BaseFinanciera = Awaited<ReturnType<typeof obtenerBaseFinanciera>>
