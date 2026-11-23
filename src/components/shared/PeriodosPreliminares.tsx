'use client'
import { useEffect, useState } from 'react'
import { apiClient } from '@/services/api'
import type { PeriodoFinanciero } from '@/lib/periodoFinanciero'
import AvisoPeriodoFinanciero from './AvisoPeriodoFinanciero'

export default function PeriodosPreliminares() {
  const [periodos,setPeriodos] = useState<PeriodoFinanciero[]>([])
  const [error,setError] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    void apiClient.get<PeriodoFinanciero[]>('/analisis/periodos',{signal:controller.signal}).then(r => {
      if (!controller.signal.aborted) setPeriodos(r.data.filter(p => !p.completo))
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  },[])
  if (error) return <p role="alert">No se pudo comprobar el estado de los ejercicios. Verifique su cierre antes de interpretar resultados como definitivos.</p>
  return <>{periodos.map(p => <AvisoPeriodoFinanciero key={p.anio} periodo={p} />)}</>
}
