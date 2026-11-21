import { supabaseAdmin } from './supabase/admin'
import { NotFoundException } from './errors'
import { resumirBaseFinanciera, type EstadoDisponible, type SaldosFinancieros } from './resumenFinanciero'
import { resumirDashboard, type DashboardFinanciero } from './dashboard'
import { obtenerPeriodosFinancieros } from './periodosFinancierosServidor'
import type { EmpresaPrincipal } from './empresaPrincipal'

interface LineaDashboard {
  id_linea: number; saldo: number
  estado_financiero: { anio: number; tipo_reporte: string }
  cuenta: { cue_cuenta_id: string | null; nombre_cuenta: string | null } | null
}

export async function obtenerDashboard(empresa: EmpresaPrincipal, anio?: number): Promise<DashboardFinanciero> {
  const { data: estados, error } = await supabaseAdmin.from('estado_financiero').select('anio,tipo_reporte').eq('empresa_id', empresa.empresaId).order('anio', { ascending: false })
  if (error) throw error
  const disponibles = (estados ?? []) as EstadoDisponible[]
  const anios = [...new Set(disponibles.map(estado => Number(estado.anio)))]
  const seleccionado = anio ?? anios[0]
  if (anio !== undefined && !anios.includes(anio)) throw new NotFoundException('No hay estados financieros publicados para el año seleccionado.')
  if (!seleccionado) return { empresa, anios, seleccionado: null, anterior: null, historico: [] }
  const ventana = anios.filter(valor => valor <= seleccionado).slice(0, 5).sort((a, b) => a - b)
  // Se incluye también el saldo previo de cada año para conservar los promedios de ANF.
  const necesarios = [...new Set(ventana.flatMap(valor => [valor, valor - 1]))]
  const mapas = new Map<string, SaldosFinancieros>()
  const cargarLineas = async () => {
    for (let inicio = 0; ; inicio += 1000) {
      const result = await supabaseAdmin.from('linea_estado_financiero')
        .select('id_linea,saldo,estado_financiero!inner(empresa_id,anio,tipo_reporte),cuenta!inner(cue_cuenta_id,nombre_cuenta)')
        .eq('estado_financiero.empresa_id', empresa.empresaId).in('estado_financiero.anio', necesarios)
        .order('id_linea').range(inicio, inicio + 999)
      if (result.error) throw result.error
      const filas = (result.data ?? []) as unknown as LineaDashboard[]
      for (const fila of filas) {
        const clave = `${fila.estado_financiero.anio}:${fila.estado_financiero.tipo_reporte}`
        const mapa = mapas.get(clave) ?? new Map()
        const codigo = fila.cuenta?.cue_cuenta_id?.trim() || String(fila.id_linea)
        if (!mapa.has(codigo)) mapa.set(codigo, { saldo: Number(fila.saldo), nombre: fila.cuenta?.nombre_cuenta?.trim() || `Cuenta ${codigo}` })
        mapas.set(clave, mapa)
      }
      if (filas.length < 1000) return
    }
  }
  const [periodos] = await Promise.all([
    obtenerPeriodosFinancieros(empresa.empresaId),
    cargarLineas(),
  ])
  const contables = periodos
  const resumen = (valor: number) => resumirDashboard(resumirBaseFinanciera(empresa.empresaId, valor, disponibles,
    mapas.get(`${valor}:BALANCE_GENERAL`) ?? new Map(), mapas.get(`${valor}:ESTADO_RESULTADOS`) ?? new Map(), mapas.get(`${valor - 1}:BALANCE_GENERAL`) ?? new Map()), contables.find(periodo => periodo.anio === valor))
  return { empresa, anios, seleccionado: resumen(seleccionado), anterior: anios.includes(seleccionado - 1) ? resumen(seleccionado - 1) : null, historico: ventana.map(resumen) }
}
