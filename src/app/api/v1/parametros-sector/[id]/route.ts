// /api/v1/parametros-sector/[id] — GET, PUT (partial), DELETE
// PUT replaces sector/categoria only when the ids are provided (as in Java).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapToResponseDTO } from '../route'
import { handle, NotFoundException } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data, error } = await supabaseAdmin
      .from('parametro_sector')
      .select('*')
      .eq('id_parametro_sector', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return new NextResponse(null, { status: 404 }) // bare 404, as in Java
    return NextResponse.json(await mapToResponseDTO(data))
  })
}

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const body = (await req.json()) as {
      nombreRatio?: string
      valorReferencia?: number
      fuente?: string | null
      anioReferencia?: number | null
      id_sector?: number
      id_categoria_ratio?: number
    }
    const { data: current } = await supabaseAdmin
      .from('parametro_sector')
      .select('*')
      .eq('id_parametro_sector', id)
      .maybeSingle()
    if (!current) return new NextResponse(null, { status: 404 })

    const updates: Record<string, unknown> = {}
    if (body.nombreRatio) updates.nombre_ratio = body.nombreRatio
    if (body.valorReferencia != null) updates.valor_referencia = body.valorReferencia
    if (body.fuente !== undefined) updates.fuente = body.fuente
    if (body.anioReferencia !== undefined) updates.anio_referencia = body.anioReferencia
    if (body.id_sector) updates.id_sector = body.id_sector
    if (body.id_categoria_ratio) updates.id_categoria_ratio = body.id_categoria_ratio

    const { data, error } = await supabaseAdmin
      .from('parametro_sector')
      .update(updates)
      .eq('id_parametro_sector', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(await mapToResponseDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data: current } = await supabaseAdmin
      .from('parametro_sector')
      .select('id_parametro_sector')
      .eq('id_parametro_sector', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Parámetro no encontrado')
    const { error } = await supabaseAdmin
      .from('parametro_sector')
      .delete()
      .eq('id_parametro_sector', id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
