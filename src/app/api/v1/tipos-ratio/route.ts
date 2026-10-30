// /api/v1/tipos-ratio — GET (list), POST (create)
// ALL TipoRatio DTOs are snake_case: { id_tipo_ratio, nombre_ratio,
// codigo_ratio, descripcion, unidad_ratio }.
// Parity quirk preserved: POST also accepts id_categoria_ratio (the frontend
// hardcodes 1) even though the table is not used by this entity.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export function toDTO(row: Record<string, unknown>) {
  return {
    id_tipo_ratio: row.id_tipo_ratio,
    nombre_ratio: row.nombre_ratio,
    codigo_ratio: row.codigo_ratio,
    descripcion: row.descripcion,
    unidad_ratio: row.unidad_ratio,
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('tipo_ratio')
      .select('*')
      .order('id_tipo_ratio')
    if (error) throw error
    return NextResponse.json((data ?? []).map(toDTO))
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as {
      nombre_ratio?: string
      codigo_ratio?: string | null
      descripcion?: string | null
      unidad_ratio?: string | null
    }
    if (!body.nombre_ratio) {
      throw new ValidationException('nombre_ratio: es obligatorio')
    }
    const { data, error } = await supabaseAdmin
      .from('tipo_ratio')
      .insert({
        nombre_ratio: body.nombre_ratio,
        codigo_ratio: body.codigo_ratio ?? null,
        descripcion: body.descripcion ?? null,
        unidad_ratio: body.unidad_ratio ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(toDTO(data), { status: 201 })
  })
}
