// POST /api/v1/catalogo-empresa/desactivar
// Body: { catalogoIds: number[] } — ids of catalogo rows to set activo=false.
// Unknown ids are silently ignored (as in the Java implementation).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as { catalogoIds?: number[] }
    const ids = (body.catalogoIds ?? []).map(Number).filter((n) => Number.isFinite(n))
    if (ids.length > 0) {
      const { error } = await supabaseAdmin
        .from('catalogo')
        .update({ activo: false })
        .in('id_catalogo', ids)
      if (error) throw error
    }
    return new NextResponse(null, { status: 200 })
  })
}
