// GET /api/v1/cuentas-maestro/tree
// Full recursive tree of the master chart of accounts.
// Node: { cuentaId, codigoCuenta, nombreCuenta, esMovimiento, children[] }
import { supabaseAdmin } from '@/lib/supabase/admin'
import { handle } from '@/lib/errors'
import type { CuentaNodeDTO } from '@/types'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  return handle(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('cuenta')
      .select('cuenta_id, cue_cuenta_id, nombre_cuenta, id_cuenta_padre, is_postable')
      .order('cuenta_id')
    if (error) throw error

    const nodes = new Map<number, CuentaNodeDTO>()
    for (const row of (data ?? []) as {
      cuenta_id: number
      cue_cuenta_id: string
      nombre_cuenta: string
      id_cuenta_padre: number | null
      is_postable: boolean
    }[]) {
      nodes.set(row.cuenta_id, {
        cuentaId: row.cuenta_id,
        codigoCuenta: row.cue_cuenta_id,
        nombreCuenta: row.nombre_cuenta,
        esMovimiento: row.is_postable,
        children: [],
      })
    }
    const roots: CuentaNodeDTO[] = []
    for (const row of (data ?? []) as {
      cuenta_id: number
      id_cuenta_padre: number | null
    }[]) {
      const node = nodes.get(row.cuenta_id)!
      const parent = row.id_cuenta_padre != null ? nodes.get(row.id_cuenta_padre) : null
      if (parent) parent.children.push(node)
      else roots.push(node)
    }
    return NextResponse.json(roots)
  })
}
