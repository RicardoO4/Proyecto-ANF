// /api/v1/tipos-ratio/[id] — GET, PUT, DELETE (snake_case DTOs)
import { supabaseAdmin } from '@/lib/supabase/admin'
import { toDTO } from '../route'
import { handle, NotFoundException } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data, error } = await supabaseAdmin
      .from('tipo_ratio')
      .select('*')
      .eq('id_tipo_ratio', id)
      .maybeSingle()
    if (error) throw error
    if (!data) return new NextResponse(null, { status: 404 })
    return NextResponse.json(toDTO(data))
  })
}

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const body = (await req.json()) as {
      nombre_ratio?: string
      codigo_ratio?: string | null
      descripcion?: string | null
      unidad_ratio?: string | null
    }
    const { data, error } = await supabaseAdmin
      .from('tipo_ratio')
      .update({
        ...(body.nombre_ratio ? { nombre_ratio: body.nombre_ratio } : {}),
        ...(body.codigo_ratio !== undefined ? { codigo_ratio: body.codigo_ratio } : {}),
        ...(body.descripcion !== undefined ? { descripcion: body.descripcion } : {}),
        ...(body.unidad_ratio !== undefined ? { unidad_ratio: body.unidad_ratio } : {}),
      })
      .eq('id_tipo_ratio', id)
      .select('*')
      .single()
    if (error) throw error
    if (!data) return new NextResponse(null, { status: 404 })
    return NextResponse.json(toDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { error } = await supabaseAdmin.from('tipo_ratio').delete().eq('id_tipo_ratio', id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
