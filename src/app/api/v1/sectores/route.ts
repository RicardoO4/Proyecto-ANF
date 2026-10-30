// /api/v1/sectores — GET (list), POST (create)
// SectorDTO: { idSector, nombreSector, descripcion, paisReferencia, fuenteDatos }
// Business rule preserved: duplicate nombreSector → 409.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BusinessRuleException, ValidationException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type SectorInput = {
  nombreSector?: string
  descripcion?: string | null
  paisReferencia?: string | null
  fuenteDatos?: string | null
}

function toDTO(row: Record<string, unknown>) {
  return {
    idSector: row.id_sector,
    nombreSector: row.nombre_sector,
    descripcion: row.descripcion,
    paisReferencia: row.pais_referencia,
    fuenteDatos: row.fuente_datos,
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const { data, error } = await supabaseAdmin.from('sector').select('*').order('id_sector')
    if (error) throw error
    return NextResponse.json((data ?? []).map(toDTO))
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as SectorInput
    if (!body.nombreSector || body.nombreSector.trim() === '') {
      throw new ValidationException('nombreSector: El nombre del sector es obligatorio')
    }
    if (body.nombreSector.length > 100) {
      throw new ValidationException('nombreSector: no puede exceder 100 caracteres')
    }
    const { data: dup } = await supabaseAdmin
      .from('sector')
      .select('id_sector')
      .eq('nombre_sector', body.nombreSector)
      .maybeSingle()
    if (dup) {
      throw new BusinessRuleException('Ya existe un sector con ese nombre.')
    }
    const { data, error } = await supabaseAdmin
      .from('sector')
      .insert({
        nombre_sector: body.nombreSector,
        descripcion: body.descripcion ?? null,
        pais_referencia: body.paisReferencia ?? null,
        fuente_datos: body.fuenteDatos ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(toDTO(data), { status: 201 })
  })
}
