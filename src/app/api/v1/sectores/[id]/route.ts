// /api/v1/sectores/[id] — GET, PUT, DELETE
// PUT keeps the original rule: body.idSector must match the path id (400 if not).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, BusinessRuleException, NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

function toDTO(row: Record<string, unknown>) {
  return {
    idSector: row.id_sector,
    nombreSector: row.nombre_sector,
    descripcion: row.descripcion,
    paisReferencia: row.pais_referencia,
    fuenteDatos: row.fuente_datos,
  }
}

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data, error } = await supabaseAdmin
      .from('sector')
      .select('*')
      .eq('id_sector', id)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException('Sector no encontrado')
    return NextResponse.json(toDTO(data))
  })
}

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const body = (await req.json()) as {
      idSector?: number
      nombreSector?: string
      descripcion?: string | null
      paisReferencia?: string | null
      fuenteDatos?: string | null
    }
    if (body.idSector != null && Number(body.idSector) !== id) {
      // controller rejects with a bare 400 when ids disagree
      return new NextResponse(null, { status: 400 })
    }
    if (!body.nombreSector) {
      throw new BadRequestException('El nombre del sector es obligatorio.')
    }
    const { data: current } = await supabaseAdmin
      .from('sector')
      .select('id_sector')
      .eq('id_sector', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Sector no encontrado')

    const { data: dup } = await supabaseAdmin
      .from('sector')
      .select('id_sector')
      .eq('nombre_sector', body.nombreSector)
      .maybeSingle()
    if (dup && Number((dup as { id_sector: number }).id_sector) !== id) {
      throw new BusinessRuleException('Ya existe un sector con ese nombre.')
    }

    const { data, error } = await supabaseAdmin
      .from('sector')
      .update({
        nombre_sector: body.nombreSector,
        descripcion: body.descripcion ?? null,
        pais_referencia: body.paisReferencia ?? null,
        fuente_datos: body.fuenteDatos ?? null,
      })
      .eq('id_sector', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(toDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data: current } = await supabaseAdmin
      .from('sector')
      .select('id_sector')
      .eq('id_sector', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Sector no encontrado')
    const { error } = await supabaseAdmin.from('sector').delete().eq('id_sector', id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
