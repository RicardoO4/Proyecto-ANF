// /api/v1/ratios/[id] — PUT (update), DELETE.
// Parity: empresa_id and id_parametro_sector from the body are IGNORED (as in
// the original RatioUpdateDTO handling).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapRatioResponse } from '@/lib/ratios'
import { handle, NotFoundException, ValidationException } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const body = (await req.json()) as {
      anio_ratio?: number
      periodo_ratio?: string
      valor_calculado?: number
      interpretacion?: string | null
      empresa_id?: number
      id_categoria_ratio?: number
    }
    const { data: current } = await supabaseAdmin
      .from('ratio')
      .select('id_ratio')
      .eq('id_ratio', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Ratio no encontrado')

    if (body.id_categoria_ratio != null) {
      const { data: cat } = await supabaseAdmin
        .from('categoria_ratio')
        .select('id_categoria_ratio')
        .eq('id_categoria_ratio', Number(body.id_categoria_ratio))
        .maybeSingle()
      if (!cat) throw new NotFoundException('Categoría no encontrada')
    }

    const { data, error } = await supabaseAdmin
      .from('ratio')
      .update({
        anio_ratio: body.anio_ratio ?? null,
        periodo_ratio: body.periodo_ratio ?? null,
        valor_calculado: body.valor_calculado ?? null,
        interpretacion: body.interpretacion ?? null,
        ...(body.id_categoria_ratio ? { id_categoria_ratio: Number(body.id_categoria_ratio) } : {}),
      })
      .eq('id_ratio', id)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(await mapRatioResponse(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data: current } = await supabaseAdmin
      .from('ratio')
      .select('id_ratio')
      .eq('id_ratio', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Ratio no encontrado')
    const { error } = await supabaseAdmin.from('ratio').delete().eq('id_ratio', id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}

void ValidationException
