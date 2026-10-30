// /api/v1/usuarios/[id] — GET, PUT, DELETE
// Edit semantics preserved: password only re-hashed when a non-blank one is
// provided; duplicate userName check excludes self.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, BusinessRuleException, NotFoundException, handle } from '@/lib/errors'
import { createAuthUserForUsuario, deleteAuthUserForUsuario } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

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

function select() {
  return 'usuario_id, nombre_usuario, apellido_usuario, user_name, rol'
}

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data, error } = await supabaseAdmin
      .from('usuario')
      .select(select())
      .eq('usuario_id', id)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException('Usuario no encontrado')
    return NextResponse.json(toResponseDTO(data))
  })
}

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
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
        .select('usuario_id, auth_user_id')
        .eq('user_name', body.userName)
        .maybeSingle()
      if (existing && Number(existing.usuario_id) !== id) {
        throw new BusinessRuleException(
          `El nombre de usuario '${body.userName}' ya está en uso.`,
        )
      }
    }

    const { data: current } = await supabaseAdmin
      .from('usuario')
      .select('*')
      .eq('usuario_id', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Usuario no encontrado')

    const updates: Record<string, unknown> = {}
    if (body.nombreUsuario) updates.nombre_usuario = body.nombreUsuario
    if (body.apellidoUsuario) updates.apellido_usuario = body.apellidoUsuario
    if (body.userName) {
      updates.user_name = body.userName
      // keep the Supabase Auth identity email in sync with the new userName
      if (current.auth_user_id) {
        const normalized = body.userName
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9._+-]/g, '')
        await supabaseAdmin.auth.admin.updateUserById(current.auth_user_id, {
          email: `${normalized}@anf.local`,
        })
      }
    }
    if (body.rol) updates.rol = body.rol
    if (body.contrasena && String(body.contrasena).trim() !== '') {
      const hash = bcrypt.hashSync(String(body.contrasena), 10)
      updates.contrasena = hash
      if (current.auth_user_id) {
        await supabaseAdmin.auth.admin.updateUserById(current.auth_user_id, {
          password: String(body.contrasena),
        })
      }
    }

    const { data, error } = await supabaseAdmin
      .from('usuario')
      .update(updates)
      .eq('usuario_id', id)
      .select(select())
      .single()
    if (error) throw error
    return NextResponse.json(toResponseDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const { data: current } = await supabaseAdmin
      .from('usuario')
      .select('usuario_id, auth_user_id')
      .eq('usuario_id', id)
      .maybeSingle()
    if (!current) throw new NotFoundException('Usuario no encontrado')
    await deleteAuthUserForUsuario((current as { auth_user_id: string | null }).auth_user_id)
    const { error } = await supabaseAdmin
      .from('usuario')
      .delete()
      .eq('usuario_id', id)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}

// keeps the import used (parity helper for future routes)
void BadRequestException
void createAuthUserForUsuario
