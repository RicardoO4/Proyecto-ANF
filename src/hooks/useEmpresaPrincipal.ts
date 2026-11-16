'use client'

// Monoempresa (Módulo A, A4): every screen works with the empresa
// principal instead of asking the user to pick one.
import { useEffect, useState } from 'react'
import { empresaService } from '@/services/empresaService'
import type { EmpresaPrincipalDTO } from '@/services/empresaService'

let cache: Promise<EmpresaPrincipalDTO> | null = null

function fetchPrincipal(): Promise<EmpresaPrincipalDTO> {
  if (!cache) {
    cache = empresaService.getEmpresaPrincipal().catch((err) => {
      cache = null
      throw err
    })
  }
  return cache
}

export function useEmpresaPrincipal(onLoad?: (empresa: EmpresaPrincipalDTO) => void) {
  const [empresa, setEmpresa] = useState<EmpresaPrincipalDTO | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelado = false
    fetchPrincipal()
      .then((data) => {
        if (cancelado) return
        setEmpresa(data)
        onLoad?.(data)
      })
      .catch((err) => {
        console.error('Error al cargar la empresa principal:', err)
        if (!cancelado) setError(true)
      })
    return () => {
      cancelado = true
    }
    // onLoad runs once per mount on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { empresa, error }
}
