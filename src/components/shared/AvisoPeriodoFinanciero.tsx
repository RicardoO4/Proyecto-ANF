import type { PeriodoFinanciero } from '@/lib/periodoFinanciero'

const fecha = (valor: string) => valor.slice(0,10).split('-').reverse().join('/')
export default function AvisoPeriodoFinanciero({periodo}: {periodo?: PeriodoFinanciero}) {
  if (!periodo) return null
  return <div className="alert alert-info my-3" role="note">
    <strong>{periodo.anio} · {periodo.completo ? 'Ejercicio completo' : 'Análisis preliminar'}</strong>
    <span> · {periodo.fechaCorte ? `Corte: ${fecha(periodo.fechaCorte)}` : 'Corte no registrado en la publicación'}.</span>
    {periodo.publicadoEn && <span> Publicado el {fecha(periodo.publicadoEn)}.</span>}
    {!periodo.completo && <span> Resultados acumulados del ejercicio; los importes no se extrapolan a doce meses. Compare resultados de cortes equivalentes.</span>}
    {periodo.cambiosPendientes && <span> Hay cambios contables pendientes de envío; se muestra la última versión publicada en ANF.</span>}
  </div>
}
