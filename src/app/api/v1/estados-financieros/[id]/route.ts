// /api/v1/estados-financieros/[id] — GET (detail) and DELETE.
// Deleting an estado financiero cascades to its lineas (schema ON DELETE CASCADE).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data, error } = await supabaseAdmin
      .from('estado_financiero')
      .select(
        'id_estado_financiero, anio, tipo_reporte, empresa_id, empresa!inner(nombre_empresa), linea_estado_financiero(id_linea, saldo, cuenta_id, cuenta!inner(cue_cuenta_id, nombre_cuenta))',
      )
      .eq('id_estado_financiero', id)
      .maybeSingle()
    if (error) throw error
    const ef = data as unknown as {
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
    } | null
    if (!ef) throw new NotFoundException('Estado financiero no encontrado')

    return NextResponse.json({
      id: ef.id_estado_financiero,
      anio: ef.anio,
      tipoReporte: ef.tipo_reporte,
      empresaId: ef.empresa_id,
      nombreEmpresa: ef.empresa.nombre_empresa,
      lineas: (ef.linea_estado_financiero ?? []).map((l) => ({
        id: l.id_linea,
        saldo: Number(l.saldo),
        cuentaId: l.cuenta_id,
        codigoCuenta: l.cuenta.cue_cuenta_id,
        nombreCuenta: l.cuenta.nombre_cuenta,
      })),
    })
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data } = await supabaseAdmin
      .from('estado_financiero')
      .select('id_estado_financiero')
      .eq('id_estado_financiero', id)
      .maybeSingle()
    if (!data) throw new NotFoundException('Estado financiero no encontrado')
    const { error } = await supabaseAdmin
      .from('estado_financiero')
      .delete()
      .eq('id_estado_financiero', id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
