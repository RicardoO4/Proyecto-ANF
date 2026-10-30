// /api/v1/usuarios/[id]/accesos — GET/PUT the permission rows
// ADDITION to the original API: the Java backend had no endpoints for
// acceso_usuario (rows were managed directly in the DB). These endpoints
// expose the same data so the permission model can be managed from the app.
// Response / body shape: { accesos: number[] } (menu option ids 0..7).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUsuarioAccesos } from '@/lib/auth'
import { NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data: u } = await supabaseAdmin
      .from('usuario')
      .select('usuario_id')
      .eq('usuario_id', id)
      .maybeSingle()
    if (!u) throw new NotFoundException('Usuario no encontrado')
    const accesos = await getUsuarioAccesos(id)
    return NextResponse.json({ accesos })
  })
}

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const body = (await req.json()) as { accesos?: number[] }
    const accesos = (body.accesos ?? []).map((n) => String(Math.trunc(Number(n))))

    const { data: u } = await supabaseAdmin
      .from('usuario')
      .select('usuario_id')
      .eq('usuario_id', id)
      .maybeSingle()
    if (!u) throw new NotFoundException('Usuario no encontrado')

    const { error: delError } = await supabaseAdmin
      .from('acceso_usuario')
      .delete()
      .eq('usuario_id', id)
    if (delError) throw delError

    if (accesos.length > 0) {
      const unique = [...new Set(accesos)]
      // validate options exist
      const { data: options } = await supabaseAdmin.from('opcion_form').select('id_opcion')
      const valid = new Set((options ?? []).map((o) => o.id_opcion as string))
      const rows = unique.filter((v) => valid.has(v)).map((id_opcion) => ({ usuario_id: id, id_opcion }))
      if (rows.length > 0) {
        const { error } = await supabaseAdmin.from('acceso_usuario').insert(
          rows as unknown as Record<string, unknown>[],
        )
        if (error) throw error
      }
    }
    return NextResponse.json({ accesos: await getUsuarioAccesos(id) })
  })
}
