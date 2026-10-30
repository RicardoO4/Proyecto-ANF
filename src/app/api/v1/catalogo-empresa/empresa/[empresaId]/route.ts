// GET /api/v1/catalogo-empresa/empresa/[empresaId]
// Active catalog rows with the account info flattened:
// { idCatalogo, activo, empresaId, cuentaId, codigoCuenta, nombreCuenta, tipoCuenta, esMovimiento }
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ empresaId: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const empresaId = Number((await params).empresaId)
    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    const { data, error } = await supabaseAdmin
      .from('catalogo')
      .select(
        'id_catalogo, activo, empresa_id, cuenta_id, cuenta!inner(cue_cuenta_id, nombre_cuenta, tipo_cuenta, is_postable)',
      )
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .order('id_catalogo')
    if (error) throw error

    const mapped = ((data ?? []) as unknown as {
      id_catalogo: number
      activo: boolean
      empresa_id: number
      cuenta_id: number
      cuenta: { cue_cuenta_id: string; nombre_cuenta: string; tipo_cuenta: string | null; is_postable: boolean }
    }[]).map((row) => ({
      idCatalogo: row.id_catalogo,
      activo: row.activo,
      empresaId: row.empresa_id,
      cuentaId: row.cuenta_id,
      codigoCuenta: row.cuenta.cue_cuenta_id,
      nombreCuenta: row.cuenta.nombre_cuenta,
      tipoCuenta: row.cuenta.tipo_cuenta,
      esMovimiento: row.cuenta.is_postable,
    }))
    return NextResponse.json(mapped)
  })
}
