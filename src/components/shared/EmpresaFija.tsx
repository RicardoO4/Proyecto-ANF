'use client'

// Drop-in replacement for the old empresa <select> (monoempresa, A4):
// same element, so each screen keeps its own select styles, but locked to
// the empresa principal.
import type { EmpresaPrincipalDTO } from '@/services/empresaService'

interface Props {
  empresa: EmpresaPrincipalDTO | null
  error?: boolean
  id?: string
  className?: string
}

const EmpresaFija = ({ empresa, error = false, id = 'empresa', className }: Props) => (
  <select id={id} className={className} value={empresa?.empresaId ?? ''} disabled onChange={() => {}}>
    <option value={empresa?.empresaId ?? ''}>
      {error ? 'No se pudo cargar la empresa' : (empresa?.nombreEmpresa ?? 'Cargando...')}
    </option>
  </select>
)

export default EmpresaFija
