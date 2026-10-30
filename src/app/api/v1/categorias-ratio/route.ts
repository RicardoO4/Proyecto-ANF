// /api/v1/categorias-ratio — GET (list), POST (create)
// Response: { idCategoriaRatio, nombreTipo, descripcion, nombreTipoRatio }
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function mapToResponseDTO(row: Record<string, unknown>) {
  let nombreTipoRatio: string | null = null
  if (row.id_tipo_ratio) {
    const { data } = await supabaseAdmin
      .from('tipo_ratio')
      .select('nombre_ratio')
      .eq('id_tipo_ratio', row.id_tipo_ratio)
      .maybeSingle()
    nombreTipoRatio = ((data as { nombre_ratio: string } | null) ?? null)?.nombre_ratio ?? null
  }
  return {
    idCategoriaRatio: row.id_categoria_ratio,
    nombreTipo: row.nombre_tipo,
    descripcion: row.descripcion,
    nombreTipoRatio,
    idTipoRatio: row.id_tipo_ratio,
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('categoria_ratio')
      .select('*')
      .order('id_categoria_ratio')
    if (error) throw error
    const mapped = await Promise.all((data ?? []).map(mapToResponseDTO))
    return NextResponse.json(mapped)
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as {
      nombreTipo?: string
      descripcion?: string | null
      idTipoRatio?: number
    }
    if (!body.nombreTipo || body.nombreTipo.trim() === '') {
      throw new ValidationException('nombreTipo: es obligatorio')
    }
    if (body.nombreTipo.length > 50) {
      throw new ValidationException('nombreTipo: no puede exceder 50 caracteres')
    }
    if (!body.idTipoRatio) {
      throw new ValidationException('idTipoRatio: es obligatorio')
    }
    const { data, error } = await supabaseAdmin
      .from('categoria_ratio')
      .insert({
        nombre_tipo: body.nombreTipo,
        descripcion: body.descripcion ?? null,
        id_tipo_ratio: Number(body.idTipoRatio),
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(await mapToResponseDTO(data), { status: 201 })
  })
}
