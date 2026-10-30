// POST /api/v1/catalogo-empresa/activar
// Body: { empresaId: number, cuentaIds: number[] } — master cuenta_id values.
// For each cuenta: if a catalogo row exists → set activo=true (only if it
// was false); else insert a new row with activo=true. Always returns 200 empty.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as { empresaId?: number; cuentaIds?: number[] }
    const empresaId = Number(body.empresaId)
    const cuentaIds = (body.cuentaIds ?? []).map(Number).filter((n) => Number.isFinite(n))
    if (!Number.isFinite(empresaId) || cuentaIds.length === 0) {
      return new NextResponse(null, { status: 200 })
    }

    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    const { data: cuentas } = await supabaseAdmin
      .from('cuenta')
      .select('cuenta_id')
      .in('cuenta_id', cuentaIds)
    if (!cuentas || cuentas.length === 0) {
      throw new NotFoundException('Cuenta no encontrada')
    }

    const { data: existing } = await supabaseAdmin
      .from('catalogo')
      .select('id_catalogo, activo, cuenta_id')
      .eq('empresa_id', empresaId)
      .in('cuenta_id', cuentas.map((c) => c.cuenta_id as number))

    const existingByCuenta = new Map<number, { id_catalogo: number; activo: boolean }>()
    for (const row of (existing ?? []) as { id_catalogo: number; activo: boolean; cuenta_id: number }[]) {
      existingByCuenta.set(row.cuenta_id, { id_catalogo: row.id_catalogo, activo: row.activo })
    }

    for (const cuentaId of cuentaIds) {
      const existingRow = existingByCuenta.get(cuentaId)
      if (existingRow) {
        if (!existingRow.activo) {
          await supabaseAdmin
            .from('catalogo')
            .update({ activo: true })
            .eq('id_catalogo', existingRow.id_catalogo)
        }
      } else {
        await supabaseAdmin
          .from('catalogo')
          .insert({ activo: true, empresa_id: empresaId, cuenta_id: cuentaId })
      }
    }
    return new NextResponse(null, { status: 200 })
  })
}
