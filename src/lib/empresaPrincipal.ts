// Empresa principal (Módulo A, A4): the system runs as single-company in
// the UI while every table keeps its empresa_id, so ratios and sector
// benchmarks still work relationally.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException } from '@/lib/errors'

export interface EmpresaPrincipal {
  empresaId: number
  nombreEmpresa: string
  idSector: number | null
}

type EmpresaRow = { empresa_id: number; nombre_empresa: string; id_sector: number | null }

function toDTO(row: EmpresaRow): EmpresaPrincipal {
  return { empresaId: row.empresa_id, nombreEmpresa: row.nombre_empresa, idSector: row.id_sector }
}

/**
 * The empresa flagged es_principal. Falls back to the lowest empresa_id
 * when none is flagged or migration 005 has not been applied yet.
 */
export async function getEmpresaPrincipal(): Promise<EmpresaPrincipal> {
  const { data, error } = await supabaseAdmin
    .from('empresa')
    .select('empresa_id, nombre_empresa, id_sector')
    .eq('es_principal', true)
    .maybeSingle()
  if (!error && data) return toDTO(data as EmpresaRow)
  // 42703 = column es_principal does not exist (005 not applied)
  if (error && error.code !== '42703') throw error

  const { data: primera, error: err2 } = await supabaseAdmin
    .from('empresa')
    .select('empresa_id, nombre_empresa, id_sector')
    .order('empresa_id')
    .limit(1)
    .maybeSingle()
  if (err2) throw err2
  if (!primera) throw new NotFoundException('No hay ninguna empresa registrada.')
  return toDTO(primera as EmpresaRow)
}
