// Auth helpers shared by Route Handlers.
//
// Design: users authenticate through Supabase Auth, but the login CONTRACT
// is the original one — POST /api/auth/login { userName, contrasena } →
// { token, userName, rol, id, accesos: number[] }.
//
//userName → Supabase email mapping: {userName, normalized}@ANF_EMAIL_DOMAIN
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { UsuarioRow } from '@/types'

export const ANF_EMAIL_DOMAIN = 'anf.local'

/**
 * Normalizes a userName into a valid email for Supabase Auth.
 * Must be deterministic — the same function is used at signup (user
 * creation) and at login.
 */
export function userNameToEmail(userName: string): string {
  const normalized = userName
    .trim()
    .toLowerCase()
    // remove diacritics
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // keep only valid local-part characters
    .replace(/[^a-z0-9._+-]/g, '')
  return `${normalized}@${ANF_EMAIL_DOMAIN}`
}

/** Finds the public.usuario row by its original userName column. */
export async function findUsuarioByUserName(
  userName: string,
): Promise<UsuarioRow | null> {
  const { data, error } = await supabaseAdmin
    .from('usuario')
    .select('*')
    .eq('user_name', userName)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as UsuarioRow) ?? null
}

export async function findUsuarioById(id: number): Promise<UsuarioRow | null> {
  const { data, error } = await supabaseAdmin
    .from('usuario')
    .select('*')
    .eq('usuario_id', id)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as UsuarioRow) ?? null
}

/** accesos[] = numeric id_opcion values of the user's AccesoUsuario rows. */
export async function getUsuarioAccesos(usuarioId: number): Promise<number[]> {
  const { data, error } = await supabaseAdmin
    .from('acceso_usuario')
    .select('id_opcion')
    .eq('usuario_id', usuarioId)
  if (error) throw error
  return (data ?? [])
    .map((row) => parseInt(row.id_opcion, 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)
}

/**
 * Issues a Supabase session for {userName, contrasena} and returns the
 * original LoginResponse contract. Throws Error('Usuario no encontrado') /
 * Error('Contraseña incorrecta') like the original AuthService.
 */
export async function authenticate(userName: string, contrasena: string) {
  const usuario = await findUsuarioByUserName(userName)
  if (!usuario) {
    throw new Error('Usuario no encontrado')
  }
  const email = usuario.auth_user_id
    ? undefined // resolve email from the auth user below
    : userNameToEmail(userName)

  // resolve the real email from auth.users when we have the id
  let authEmail = email
  if (usuario.auth_user_id) {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(
      usuario.auth_user_id,
    )
    if (error || !data?.user?.email) {
      throw new Error('Usuario no encontrado')
    }
    authEmail = data.user.email
  }
  if (!authEmail) throw new Error('Usuario no encontrado')

  // Sign in with a dedicated anon client. Doing it on the shared admin client
  // would replace its Authorization header with the user's JWT, so every
  // later service-role query (usuario, acceso_usuario, ...) would be subject
  // to RLS and silently return no rows.
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { data, error } = await authClient.auth.signInWithPassword({
    email: authEmail,
    password: contrasena,
  })
  if (error || !data?.session) {
    throw new Error('Contraseña incorrecta')
  }

  const accesos = await getUsuarioAccesos(usuario.usuario_id)
  return {
    token: data.session.access_token,
    userName: usuario.user_name,
    rol: usuario.rol,
    id: usuario.usuario_id,
    accesos,
  }
}

/**
 * Creates both the public.usuario row and its Supabase Auth identity.
 * Used by POST /api/v1/usuarios to keep the two stores in sync.
 */
export async function createAuthUserForUsuario(params: {
  userName: string
  contrasena: string
  nombreUsuario: string
  apellidoUsuario: string
  rol: string
}): Promise<{ usuario: UsuarioRow }> {
  const email = userNameToEmail(params.userName)

  // 1) Supabase Auth identity
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: params.contrasena,
    email_confirm: true,
    user_metadata: {
      user_name: params.userName,
      nombre: params.nombreUsuario,
      apellido: params.apellidoUsuario,
      rol: params.rol,
    },
  })
  if (error || !data?.user) {
    throw new Error(
      error?.message ?? 'No se pudo crear el usuario de autenticación',
    )
  }

  // 2) public.usuario row (contrasena keeps a bcrypt hash for parity
  // with the original schema; actual verification lives in Supabase Auth)
  const hash = bcrypt.hashSync(params.contrasena, 10)
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('usuario')
    .insert({
      nombre_usuario: params.nombreUsuario,
      apellido_usuario: params.apellidoUsuario,
      user_name: params.userName,
      contrasena: hash,
      rol: params.rol,
      auth_user_id: data.user.id,
    })
    .select('*')
    .single()
  if (insertError) {
    // clean up the orphan auth identity
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    throw insertError
  }
  return { usuario: inserted as unknown as UsuarioRow }
}

/** Deletes the Supabase Auth identity tied to a usuario row (if any). */
export async function deleteAuthUserForUsuario(authUserId: string | null) {
  if (!authUserId) return
  await supabaseAdmin.auth.admin.deleteUser(authUserId)
}
