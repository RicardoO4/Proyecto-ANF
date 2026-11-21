// Server-side authorization for /api/v1 (Módulo A, A8). The menu already
// hides options per user, but the API must enforce the same rules: a
// request needs a valid Supabase session, and writes need the access of
// the module (same id_opcion values the sidebar uses in menuConfig.ts).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUsuarioAccesos } from '@/lib/auth'
import { ForbiddenException, UnauthorizedException } from '@/lib/errors'
import { rutaPermitidaPorRol } from '@/lib/roles'

export interface UsuarioSesion {
  usuarioId: number
  userName: string
  rol: string
  accesos: number[]
}

type Regla = { prefijo: string; opcion: number | null; soloEscritura: boolean; soloAdmin?: boolean }

// Longest prefix wins. opcion = id_opcion required (null = only a session).
const REGLAS: Regla[] = [
  { prefijo: '/api/v1/contabilidad', opcion: 8, soloEscritura: false },
  { prefijo: '/api/v1/usuarios', opcion: 4, soloEscritura: false, soloAdmin: true },
  { prefijo: '/api/v1/empresas/principal', opcion: null, soloEscritura: false },
  { prefijo: '/api/v1/empresas', opcion: 1, soloEscritura: true },
  { prefijo: '/api/v1/analisis', opcion: 2, soloEscritura: true },
  { prefijo: '/api/v1/ratios', opcion: 3, soloEscritura: true },
  { prefijo: '/api/v1/inventarios', opcion: 3, soloEscritura: false },
  { prefijo: '/api/v1/categorias-ratio', opcion: 3, soloEscritura: true },
  { prefijo: '/api/v1/tipos-ratio', opcion: 3, soloEscritura: true },
  { prefijo: '/api/v1/parametros-sector', opcion: 3, soloEscritura: true },
  { prefijo: '/api/v1/sectores', opcion: 3, soloEscritura: true },
  { prefijo: '/api/v1/catalogo-empresa', opcion: 5, soloEscritura: true },
  { prefijo: '/api/v1/cuentas-maestro', opcion: 5, soloEscritura: true },
  { prefijo: '/api/v1/ventas-historicas', opcion: 6, soloEscritura: true },
  { prefijo: '/api/v1/presupuestos', opcion: 6, soloEscritura: true },
  { prefijo: '/api/v1/evaluaciones-capital', opcion: 6, soloEscritura: true },
  { prefijo: '/api/v1/estados-financieros', opcion: 7, soloEscritura: true },
].sort((a, b) => b.prefijo.length - a.prefijo.length)

const CACHE_MS = 60_000
const cache = new Map<string, { usuarioId: number; authId: string; hasta: number }>()
const credencialesPorRequest=new WeakMap<Request,Promise<UsuarioSesion>>()
export function invalidarPermisos(usuarioId: number) {
  for (const [token, entry] of cache) if (entry.usuarioId === usuarioId) cache.delete(token)
}

async function usuarioDelToken(token: string): Promise<UsuarioSesion> {
  const cached = cache.get(token)
  const vigente=cached&&cached.hasta>Date.now()
  let authId=vigente?cached.authId:undefined
  if(!authId){
    const {data,error}=await supabaseAdmin.auth.getUser(token)
    if(error||!data?.user)throw new UnauthorizedException('Sesión inválida o vencida.')
    authId=data.user.id
  }

  const { data: row, error: rowError } = await supabaseAdmin
    .from('usuario')
    .select('usuario_id, user_name, rol')
    .eq('auth_user_id', authId)
    .maybeSingle()
  if (rowError) throw rowError
  if (!row) throw new UnauthorizedException('El usuario de la sesión no existe.')

  const usuario: UsuarioSesion = {
    usuarioId: row.usuario_id as number,
    userName: row.user_name as string,
    rol: row.rol as string,
    accesos: await getUsuarioAccesos(row.usuario_id as number),
  }
  if (cache.size > 500) cache.clear()
  // Se conserva solo la identidad validada. Rol y permisos se leen en cada request.
  cache.set(token, { usuarioId:usuario.usuarioId,authId,hasta:vigente?cached.hasta:Date.now()+CACHE_MS })
  return usuario
}

/** Throws 401 without a valid session and 403 without the module access. */
export async function autorizar(req: Request): Promise<UsuarioSesion> {
  const header = req.headers.get('authorization') ?? ''
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new UnauthorizedException('Debe iniciar sesión.')

  let sesion=credencialesPorRequest.get(req)
  if(!sesion){sesion=usuarioDelToken(token);credencialesPorRequest.set(req,sesion)}
  const usuario = await sesion
  if (usuario.rol === 'ADMIN') return usuario

  const path = new URL(req.url).pathname
  if(!rutaPermitidaPorRol(path,usuario.rol,true))throw new ForbiddenException('Su perfil no tiene acceso a esta área de trabajo.')
  const regla = REGLAS.find((r) => path === r.prefijo || path.startsWith(`${r.prefijo}/`))
  if (!regla || regla.opcion === null) return usuario

  const esLectura = req.method === 'GET' || req.method === 'HEAD'
  if (!esLectura && ['/api/v1/catalogo-empresa','/api/v1/cuentas-maestro'].includes(regla.prefijo)) {
    throw new ForbiddenException('Solo el administrador puede gestionar el catálogo de cuentas.')
  }
  if (regla.soloAdmin) {
    throw new ForbiddenException('Solo un administrador puede gestionar usuarios.')
  }
  if (regla.soloEscritura && esLectura) return usuario
  if (!usuario.accesos.includes(regla.opcion)) {
    throw new ForbiddenException('No tiene permiso para realizar esta acción en este módulo.')
  }
  return usuario
}
