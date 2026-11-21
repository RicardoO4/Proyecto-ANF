export interface PeriodoContableFinanciero {
  id?: number; anio: number; origen: string; estado: string; version: number; version_publicada: number | null
  fechaCorte?: string | null; publicadoEn?: string | null
}
export interface PeriodoFinanciero {
  anio: number
  estado: 'HISTORICO' | 'FINAL' | 'PROVISIONAL' | 'IMPORTADO'
  fechaCorte: string | null
  publicadoEn: string | null
  cambiosPendientes: boolean
  completo: boolean
}
export function describirPeriodo(anio: number, periodo?: PeriodoContableFinanciero, anioActual = new Date().getFullYear()): PeriodoFinanciero {
  const completo = periodo ? periodo.origen === 'HISTORICO' || periodo.estado === 'CERRADO' : anio < anioActual
  const estado = !completo ? 'PROVISIONAL' : !periodo ? 'IMPORTADO' : periodo.origen === 'HISTORICO' ? 'HISTORICO' : 'FINAL'
  return {
    anio, estado, completo,
    fechaCorte: completo ? `${anio}-12-31` : periodo?.fechaCorte ?? null,
    publicadoEn: periodo?.publicadoEn ?? null,
    cambiosPendientes: periodo?.origen === 'CONTABILIDAD' && periodo.version !== periodo.version_publicada,
  }
}
