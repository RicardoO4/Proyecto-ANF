// /api/v1/usuarios — GET (list), POST (create)
// UsuarioResponseDTO: { usuarioId, nombreUsuario, apellidoUsuario, userName, rol }
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, BusinessRuleException, handle } from '@/lib/errors'
import { createAuthUserForUsuario } from '@/lib/auth'
import { NextResponse } from 'next/server'

function toResponseDTO(row: unknown) {
  const r = row as Record<string, unknown>
  return {
    usuarioId: r.usuario_id,
    nombreUsuario: r.nombre_usuario,
    apellidoUsuario: r.apellido_usuario,
    userName: r.user_name,
    rol: r.rol,
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const { data, error } = await supabaseAdmin
      .from('usuario')
      .select('usuario_id, nombre_usuario, apellido_usuario, user_name, rol')
      .order('usuario_id')
    if (error) throw error
    return NextResponse.json((data ?? []).map(toResponseDTO))
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as {
      nombreUsuario?: string
      apellidoUsuario?: string
      userName?: string
      contrasena?: string | null
      rol?: string
    }

    if (body.userName) {
      const { data: existing } = await supabaseAdmin
        .from('usuario')
        .select('usuario_id')
        .eq('user_name', body.userName)
        .maybeSingle()
      if (existing) {
        throw new BusinessRuleException(
          `El nombre de usuario '${body.userName}' ya está en uso.`,
        )
      }
    }
    if (!body.nombreUsuario || !body.apellidoUsuario || !body.userName || !body.contrasena || !body.rol) {
      throw new BadRequestException('Todos los campos del usuario son obligatorios.')
    }

    const { usuario } = await createAuthUserForUsuario({
      userName: body.userName,
      contrasena: body.contrasena,
      nombreUsuario: body.nombreUsuario,
      apellidoUsuario: body.apellidoUsuario,
      rol: body.rol,
    })

    const { data: responseRow } = await supabaseAdmin
      .from('usuario')
      .select('usuario_id, nombre_usuario, apellido_usuario, user_name, rol')
      .eq('usuario_id', usuario.usuario_id)
      .single()
    return NextResponse.json(toResponseDTO(responseRow!), { status: 201 })
  })
}
