// /api/v1/categorias-ratio/[id] — GET, PUT, DELETE
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapToResponseDTO } from '../route'
import { handle, NotFoundException } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data, error } = await supabaseAdmin
      .from('categoria_ratio')
      .select('*')
      .eq('id_categoria_ratio', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return new NextResponse(null, { status: 404 })
    return NextResponse.json(await mapToResponseDTO(data))
  })
}

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const body = (await req.json()) as {
      nombreTipo?: string
      descripcion?: string | null
      idTipoRatio?: number
    }
    const updates: Record<string, unknown> = {}
    if (body.nombreTipo) updates.nombre_tipo = body.nombreTipo
    if (body.descripcion !== undefined) updates.descripcion = body.descripcion
    if (body.idTipoRatio) updates.id_tipo_ratio = Number(body.idTipoRatio)
    const { data, error } = await supabaseAdmin
      .from('categoria_ratio')
      .update(updates)
      .eq('id_categoria_ratio', id)
      .select('*')
      .single()
    if (error) throw error
    if (!data) return new NextResponse(null, { status: 404 })
    return NextResponse.json(await mapToResponseDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { error } = await supabaseAdmin
      .from('categoria_ratio')
      .delete()
      .eq('id_categoria_ratio', id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
