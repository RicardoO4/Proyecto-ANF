// Consulta de permisos derivados del rol. No admite asignaciones individuales.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUsuarioAccesos } from '@/lib/auth'
import { BadRequestException, NotFoundException, handle } from '@/lib/errors'
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
    const { data: u } = await supabaseAdmin
      .from('usuario')
      .select('usuario_id')
      .eq('usuario_id', id)
      .maybeSingle()
    if (!u) throw new NotFoundException('Usuario no encontrado')
    throw new BadRequestException('Los permisos se asignan automáticamente según el rol. Cambie el rol desde Usuarios.')
  })
}
