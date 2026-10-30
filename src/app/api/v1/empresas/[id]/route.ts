// /api/v1/empresas/[id] — GET, PUT, DELETE
// Edit semantics preserved: PUT only updates name/dui/nit/nrc (usuario and
// sector are NOT updated, exactly as in the original EmpresaService).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, BusinessRuleException, NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

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

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data, error } = await supabaseAdmin
      .from('empresa')
      .select('*')
      .eq('empresa_id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException('Empresa no encontrada')
    return NextResponse.json(await mapToResponseDTO(data))
  })
}

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const body = (await req.json()) as {
      nombreEmpresa?: string
      empresaDui?: string | null
      empresaNit?: string | null
      empresaNrc?: string | null
    }
    if (!body.nombreEmpresa) {
      throw new BadRequestException('El nombre de la empresa es obligatorio.')
    }
    const { data: current } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Empresa no encontrada')

    const { data: dupName } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('nombre_empresa', body.nombreEmpresa)
      .maybeSingle()
    if (dupName && Number((dupName as { empresa_id: number }).empresa_id) !== id) {
      throw new BusinessRuleException('Ya existe una empresa con el mismo nombre.')
    }

    const { data, error } = await supabaseAdmin
      .from('empresa')
      .update({
        nombre_empresa: body.nombreEmpresa,
        empresa_dui: body.empresaDui ?? null,
        empresa_nit: body.empresaNit ?? null,
        empresa_nrc: body.empresaNrc ?? null,
      })
      .eq('empresa_id', id)
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
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Empresa no encontrada')
    const { error } = await supabaseAdmin.from('empresa').delete().eq('empresa_id', id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
