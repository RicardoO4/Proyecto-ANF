// /api/v1/estados-financieros — GET (list), POST (create manual)
// GET response: { id, anio, tipoReporte, empresaId, nombreEmpresa,
//   lineas: [{ id, saldo, cuentaId, codigoCuenta, nombreCuenta }] }
// POST body: { empresaId, anio, tipoReporte, lineas: [{ cuentaId, saldo }] }
// Parity: no duplicate (empresa, año, tipo) guard, exactly like the original.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  return handle(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('estado_financiero')
      .select(
        'id_estado_financiero, anio, tipo_reporte, empresa_id, empresa!inner(nombre_empresa), linea_estado_financiero(id_linea, saldo, cuenta_id, cuenta!inner(cue_cuenta_id, nombre_cuenta))',
      )
      .order('id_estado_financiero')
    if (error) throw error

    const mapped = ((data ?? []) as unknown as {
      id_estado_financiero: number
      anio: number
      tipo_reporte: string
      empresa_id: number
      empresa: { nombre_empresa: string }
      linea_estado_financiero: {
        id_linea: number
        saldo: number
        cuenta_id: number
        cuenta: { cue_cuenta_id: string; nombre_cuenta: string }
      }[]
    }[]).map((row) => ({
      id: row.id_estado_financiero,
      anio: row.anio,
      tipoReporte: row.tipo_reporte,
      empresaId: row.empresa_id,
      nombreEmpresa: row.empresa?.nombre_empresa ?? '',
      lineas: (row.linea_estado_financiero ?? []).map((l) => ({
        id: l.id_linea,
        saldo: Number(l.saldo),
        cuentaId: l.cuenta_id,
        codigoCuenta: l.cuenta.cue_cuenta_id,
        nombreCuenta: l.cuenta.nombre_cuenta,
      })),
    }))
    return NextResponse.json(mapped)
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as {
      empresaId?: number
      anio?: number
      tipoReporte?: string
      lineas?: { cuentaId?: number; saldo?: number }[]
    }
    const empresaId = Number(body.empresaId)
    const anio = Number(body.anio)
    const tipoReporte = String(body.tipoReporte ?? '')
    if (!Number.isFinite(empresaId) || !Number.isFinite(anio) || !tipoReporte) {
      throw new BadRequestException('empresaId, anio y tipoReporte son obligatorios.')
    }

    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    const lineas = (body.lineas ?? []).filter(
      (l) => Number.isFinite(Number(l.cuentaId)) && Number(l.saldo) != null && Number.isFinite(Number(l.saldo)),
    )
    if (lineas.length > 0) {
      const { data: cuentas } = await supabaseAdmin
        .from('cuenta')
        .select('cuenta_id')
        .in('cuenta_id', lineas.map((l) => Number(l.cuentaId)))
      const valid = new Set((cuentas ?? []).map((c) => c.cuenta_id as number))
      for (const l of lineas) {
        if (!valid.has(Number(l.cuentaId))) {
          throw new NotFoundException(`No se encontró una cuenta con el ID: ${l.cuentaId}`)
        }
      }
    }

    const { data: ef, error } = await supabaseAdmin
      .from('estado_financiero')
      .insert({ anio, tipo_reporte: tipoReporte, empresa_id: empresaId })
      .select('id_estado_financiero')
      .single()
    if (error) throw error

    if (lineas.length > 0) {
      const rows = lineas.map((l) => ({
        id_estado_financiero: (ef as { id_estado_financiero: number }).id_estado_financiero,
        cuenta_id: Number(l.cuentaId),
        saldo: Number((l.saldo as number).toFixed(2)),
      }))
      const { error: leError } = await supabaseAdmin
        .from('linea_estado_financiero')
        .insert(rows as unknown as Record<string, unknown>[])
      if (leError) throw leError
    }
    return new NextResponse(null, { status: 201 })
  })
}
