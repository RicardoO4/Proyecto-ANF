'use client'
import { useCallback, useEffect, useState } from 'react'
import { apiClient, getErrorMessage } from '@/services/api'
import type { disponibilidadMensual } from '@/lib/ventasMensuales'
export type DisponibilidadVentas = ReturnType<typeof disponibilidadMensual> & { empresaId: number; totalesAnuales: number }
export function useDisponibilidadVentas() {
  const [datos, setDatos] = useState<DisponibilidadVentas | null>(null)
  const [error, setError] = useState('')
  const cargar = useCallback(async () => {
    try { const { data } = await apiClient.get<DisponibilidadVentas>('/ventas-historicas/disponibilidad'); setDatos(data); setError('') }
    catch (e) { setDatos(null); setError(getErrorMessage(e)) }
  }, [])
  useEffect(() => { const timer = setTimeout(() => { void cargar() }, 0); return () => clearTimeout(timer) }, [cargar])
  return { datos, error, cargar }
}
