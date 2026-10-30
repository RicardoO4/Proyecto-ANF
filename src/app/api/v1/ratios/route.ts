// /api/v1/ratios — GET (list, optional ?nombreEmpresa=), POST (create)
// Response: RatioResponseDTO with nested { empresa: {empresa_id, nombre_empresa} },
// { categoriaRatio: {id_categoria_ratio, nombre_categoria} },
// { parametroSector: {id_parametro_sector, valor_referencia, anio_referencia, nombreRatio} }.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { mapRatioResponse } from '@/lib/ratios'
import { NotFoundException, ValidationException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  return handle(req, async () => {
    const url = new URL(req.url)
    const nombreEmpresa = url.searchParams.get('nombreEmpresa')

    let query = supabaseAdmin
      .from('ratio')
      .select('*')
      .order('id_ratio')
    if (nombreEmpresa) {
      // case-insensitive filter by empresa name (as in the Java repository)
      const { data: empresas } = await supabaseAdmin
        .from('empresa')
        .select('empresa_id')
        .ilike('nombre_empresa', `%${nombreEmpresa}%`)
      const ids = (empresas ?? []).map((e) => e.empresa_id as number)
      if (ids.length === 0) return NextResponse.json([])
      query = query.in('empresa_id', ids)
    }
    const { data, error } = await query
    if (error) throw error
    const mapped = await Promise.all((data ?? []).map(mapRatioResponse))
    return NextResponse.json(mapped)
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as {
      anio_ratio?: number
      periodo_ratio?: string
      valor_calculado?: number
      interpretacion?: string | null
      empresa_id?: number
      id_categoria_ratio?: number
      id_parametro_sector?: number
    }
    if (!body.empresa_id) {
      throw new ValidationException('empresa_id: es obligatorio')
    }
    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', Number(body.empresa_id))
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    if (body.id_categoria_ratio) {
      const { data: cat } = await supabaseAdmin
        .from('categoria_ratio')
        .select('id_categoria_ratio')
        .eq('id_categoria_ratio', Number(body.id_categoria_ratio))
        .maybeSingle()
      if (!cat) throw new NotFoundException('Categoría no encontrada')
    }
    if (body.id_parametro_sector) {
      const { data: param } = await supabaseAdmin
        .from('parametro_sector')
        .select('id_parametro_sector')
        .eq('id_parametro_sector', Number(body.id_parametro_sector))
        .maybeSingle()
      if (!param) throw new NotFoundException('Parámetro no encontrado')
    }

    const { data, error } = await supabaseAdmin
      .from('ratio')
      .insert({
        anio_ratio: body.anio_ratio ?? null,
        periodo_ratio: body.periodo_ratio ?? null,
        valor_calculado: body.valor_calculado ?? null,
        interpretacion: body.interpretacion ?? null,
        empresa_id: Number(body.empresa_id),
        id_categoria_ratio: body.id_categoria_ratio ? Number(body.id_categoria_ratio) : null,
        id_parametro_sector: body.id_parametro_sector ? Number(body.id_parametro_sector) : null,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(await mapRatioResponse(data), { status: 201 })
  })
}
