'use client'
import { useRef, useState } from 'react'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import { apiClient, getErrorMessage } from '@/services/api'
import type { BaseFinanciera } from '@/lib/baseFinanciera'
export function useBaseFinanciera() {
  const [base, setBase] = useState<BaseFinanciera | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const secuencia = useRef(0)
  const cargar = async (anio?: number) => {
    const id = ++secuencia.current
    setCargando(true)
    try {
      const respuesta = await apiClient.get<BaseFinanciera>('/analisis/base-financiera', { params: { anio } })
      if (id !== secuencia.current) return
      setBase(respuesta.data); setError('')
    } catch (e) { if (id === secuencia.current) { setBase(null); setError(getErrorMessage(e)) } }
    finally { if (id === secuencia.current) setCargando(false) }
  }
  const { empresa, error: errorEmpresa } = useEmpresaPrincipal(() => { void cargar() })
  return { base, empresa, error: errorEmpresa ? 'No se pudo cargar la empresa principal.' : error, cargando, cargar }
}
