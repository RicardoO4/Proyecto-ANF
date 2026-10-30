// /api/v1/empresas — GET (list), POST (create)
// EmpresaResponseDTO: { empresaId, nombreEmpresa, empresaDui, empresaNit,
// empresaNrc, usuarioId, idSector, nombreSector }
// Business rules preserved: duplicate nombreEmpresa/empresaNit → 409.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, BusinessRuleException, NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

interface EmpresaResponseBody {
  nombreEmpresa?: string
  empresaDui?: string | null
  empresaNit?: string | null
  empresaNrc?: string | null
  usuarioId?: number | null
  idSector?: number | null
}

async function mapToResponseDTO(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  let nombreSector: string | null = null
  if (row.id_sector) {
    const { data } = await supabaseAdmin
      .from('sector')
      .select('nombre_sector')
      .eq('id_sector', row.id_sector)
      .maybeSingle()
    nombreSector = ((data as { nombre_sector: string } | null) ?? null)?.nombre_sector ?? null
  }
  return {
    empresaId: row.empresa_id,
    nombreEmpresa: row.nombre_empresa,
    empresaDui: row.empresa_dui,
    empresaNit: row.empresa_nit,
    empresaNrc: row.empresa_nrc,
    usuarioId: row.usuario_id,
    idSector: row.id_sector,
    nombreSector,
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const { data, error } = await supabaseAdmin.from('empresa').select('*').order('empresa_id')
    if (error) throw error
    const mapped = await Promise.all((data ?? []).map(mapToResponseDTO))
    return NextResponse.json(mapped)
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as EmpresaResponseBody
    if (!body.nombreEmpresa) {
      throw new BadRequestException('El nombre de la empresa es obligatorio.')
    }

    const { data: dupName } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('nombre_empresa', body.nombreEmpresa)
      .maybeSingle()
    const { data: dupNit } = body.empresaNit
      ? await supabaseAdmin.from('empresa').select('empresa_id').eq('empresa_nit', body.empresaNit).maybeSingle()
      : { data: null }
    if (dupName || dupNit) {
      throw new BusinessRuleException(
        'Ya existe una empresa con el mismo nombre o NIT.',
      )
    }

    if (body.idSector) {
      const { data: sector } = await supabaseAdmin
        .from('sector')
        .select('id_sector')
        .eq('id_sector', body.idSector)
        .maybeSingle()
      if (!sector) throw new NotFoundException('El sector especificado no existe.')
    }
    if (body.usuarioId) {
      const { data: usuario } = await supabaseAdmin
        .from('usuario')
        .select('usuario_id')
        .eq('usuario_id', body.usuarioId)
        .maybeSingle()
      if (!usuario) throw new NotFoundException('El usuario especificado no existe.')
    }

    const { data, error } = await supabaseAdmin
      .from('empresa')
      .insert({
        nombre_empresa: body.nombreEmpresa,
        empresa_dui: body.empresaDui ?? null,
        empresa_nit: body.empresaNit ?? null,
        empresa_nrc: body.empresaNrc ?? null,
        usuario_id: body.usuarioId ?? null,
        id_sector: body.idSector ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(await mapToResponseDTO(data), { status: 201 })
  })
}
