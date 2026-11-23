import { supabaseAdmin } from '@/lib/supabase/admin'
import { getSaldoMap } from '@/lib/analisis'
import { TIPO_REPORTE } from '@/lib/accountCodes'
import { NotFoundException } from '@/lib/errors'
import { resumirBaseFinanciera } from '@/lib/resumenFinanciero'
import { obtenerPeriodosFinancieros } from './periodosFinancierosServidor'
import { describirPeriodo } from './periodoFinanciero'

export async function obtenerBaseFinanciera(empresaId: number, anio?: number, soloCompletos = false) {
  const { data, error } = await supabaseAdmin.from('estado_financiero').select('anio, tipo_reporte').eq('empresa_id', empresaId).order('anio', { ascending: false })
  if (error) throw error
  const periodos = await obtenerPeriodosFinancieros(empresaId)
  const disponibles = (data ?? []).filter(r => !soloCompletos || describirPeriodo(Number(r.anio),periodos.find(p => p.anio === Number(r.anio))).completo)
  const anios = [...new Set(disponibles.map(r => Number(r.anio)))]
  const seleccionado = anio ?? anios[0]
  if (!seleccionado || !anios.includes(seleccionado)) throw new NotFoundException('No hay estados financieros para el año solicitado.')
  const [balance, resultados, anterior] = await Promise.all([
    getSaldoMap(empresaId, seleccionado, TIPO_REPORTE.BALANCE),
    getSaldoMap(empresaId, seleccionado, TIPO_REPORTE.RESULTADOS),
    getSaldoMap(empresaId, seleccionado - 1, TIPO_REPORTE.BALANCE),
  ])
  return resumirBaseFinanciera(empresaId, seleccionado, disponibles, balance, resultados, anterior, describirPeriodo(seleccionado, periodos.find(p => p.anio === seleccionado)))
}
export type BaseFinanciera = Awaited<ReturnType<typeof obtenerBaseFinanciera>>
