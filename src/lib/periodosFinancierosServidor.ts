import { supabaseAdmin } from './supabase/admin'
import type { PeriodoContableFinanciero } from './periodoFinanciero'

export async function obtenerPeriodosFinancieros(empresaId: number): Promise<PeriodoContableFinanciero[]> {
  const periodos = await supabaseAdmin.from('cont_periodo').select('id,anio,origen,estado,version,version_publicada').eq('empresa_id', empresaId)
  if (periodos.error) {
    if (['42P01','PGRST205'].includes(periodos.error.code)) return []
    throw periodos.error
  }
  const filas = (periodos.data ?? []) as PeriodoContableFinanciero[]
  const ids = filas.filter(p => p.version_publicada !== null).map(p => p.id!)
  if (!ids.length) return filas
  const publicaciones: {periodo_id:number;version:number;creado_en:string;fechaCorte:unknown}[] = []
  for (let inicio = 0; ; inicio += 1000) {
    const pagina = await supabaseAdmin.from('cont_publicacion').select('periodo_id,version,creado_en,estados->fechaCorte').in('periodo_id', ids).order('id',{ascending:false}).range(inicio,inicio+999)
    if (pagina.error) throw pagina.error
    publicaciones.push(...(pagina.data ?? []))
    if ((pagina.data?.length ?? 0) < 1000) break
  }
  return filas.map(p => {
    const snapshot = publicaciones.find(s => s.periodo_id === p.id && s.version === p.version_publicada)
    return { ...p, fechaCorte: typeof snapshot?.fechaCorte === 'string' ? snapshot.fechaCorte : null, publicadoEn: snapshot?.creado_en ?? null }
  })
}
