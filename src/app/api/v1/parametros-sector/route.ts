// /api/v1/parametros-sector — GET (list), POST (create)
// Response keeps the nested snake_case shapes:
//   sector: { id_sector, nombre_sector }
//   categoriaRatio: { id_categoria_ratio, nombre_categoria }
import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

interface Body {
  nombreRatio?: string
  valorReferencia?: number
  fuente?: string | null
  anioReferencia?: number | null
  id_sector?: number
  id_categoria_ratio?: number
}

export async function mapToResponseDTO(row: Record<string, unknown>) {
  const [sectorRes, categoriaRes] = await Promise.all([
    row.id_sector
      ? supabaseAdmin
          .from('sector')
          .select('id_sector, nombre_sector')
          .eq('id_sector', row.id_sector)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    row.id_categoria_ratio
      ? supabaseAdmin
          .from('categoria_ratio')
          .select('id_categoria_ratio, nombre_tipo')
          .eq('id_categoria_ratio', row.id_categoria_ratio)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const sector = (sectorRes.data as { id_sector: number; nombre_sector: string } | null) ?? null
  const categoria =
    (categoriaRes.data as { id_categoria_ratio: number; nombre_tipo: string } | null) ?? null
  return {
    idParametroSector: row.id_parametro_sector,
    nombreRatio: row.nombre_ratio,
    valorReferencia: row.valor_referencia == null ? null : Number(row.valor_referencia),
    fuente: row.fuente,
    anioReferencia: row.anio_referencia,
    sector: sector ? { id_sector: sector.id_sector, nombre_sector: sector.nombre_sector } : null,
    categoriaRatio: categoria
      ? { id_categoria_ratio: categoria.id_categoria_ratio, nombre_categoria: categoria.nombre_tipo }
      : null,
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('parametro_sector')
      .select('*')
      .order('id_parametro_sector')
    if (error) throw error
    const mapped = await Promise.all((data ?? []).map(mapToResponseDTO))
    return NextResponse.json(mapped)
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as Body
    if (!body.nombreRatio || body.nombreRatio.trim() === '') {
      throw new ValidationException('nombreRatio: es obligatorio')
    }
    if (body.valorReferencia == null) {
      throw new ValidationException('valorReferencia: es obligatorio')
    }
    if (!body.id_sector || !body.id_categoria_ratio) {
      throw new ValidationException('id_sector e id_categoria_ratio son obligatorios')
    }
    const { data, error } = await supabaseAdmin
      .from('parametro_sector')
      .insert({
        nombre_ratio: body.nombreRatio,
        valor_referencia: body.valorReferencia,
        fuente: body.fuente ?? null,
        anio_referencia: body.anioReferencia ?? null,
        id_sector: body.id_sector,
        id_categoria_ratio: body.id_categoria_ratio,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(await mapToResponseDTO(data), { status: 201 })
  })
}
