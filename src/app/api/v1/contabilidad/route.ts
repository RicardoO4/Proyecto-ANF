import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { autorizar } from '@/lib/permisos'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { handle, BadRequestException, BusinessRuleException, ForbiddenException } from '@/lib/errors'
import { validarPartida } from '@/lib/contabilidad'
import { recalcularRatios } from '@/lib/ratios'

export const maxDuration = 300
function rpcError(error: { code?: string; message: string }) {
  if (error.code === 'PGRST202' || error.code === '42P01') throw new BusinessRuleException('Falta aplicar la migración de Contabilidad en la base de desarrollo.')
  if (error.code === 'ANF04' || error.code === '23505') throw new BusinessRuleException(error.code === '23505' ? 'La operación ya existe. Actualice la pantalla.' : error.message)
  if (error.code?.startsWith('22') || error.code === '23514' || error.code === '23503') throw new BadRequestException('Revise fecha, cuentas e importes de la operación.')
  throw error
}
export async function GET(req: Request) {
  return handle(req, async () => {
    const empresa = await getEmpresaPrincipal()
    const id = new URL(req.url).searchParams.get('periodo')
    if (id && (!Number.isSafeInteger(Number(id)) || Number(id) <= 0)) throw new BadRequestException('Período inválido.')
    const result = await supabaseAdmin.rpc('cont_consultar', { p_empresa: empresa.empresaId, p_periodo: id ? Number(id) : null })
    if (result.error) rpcError(result.error)
    return NextResponse.json(result.data)
  })
}
const permisos: Record<string, number> = { crear_cuenta: 5, importar: 11, crear_periodo: 11, guardar: 9, descartar: 9, contabilizar: 10, revertir: 10, revision: 11, publicar: 11, cerrar: 11, reabrir: 11 }
export async function POST(req: Request) {
  return handle(req, async () => {
    const usuario = await autorizar(req)
    let body: { accion: string; datos?: Record<string, unknown> }
    try { body = await req.json() } catch { throw new BadRequestException('El cuerpo debe ser JSON válido.') }
    if (!body || Array.isArray(body) || typeof body !== 'object' || typeof body.accion !== 'string' || !Object.hasOwn(permisos,body.accion)) throw new BadRequestException('Acción desconocida.')
    const permiso = permisos[body.accion]
    if (body.accion === 'crear_cuenta' && usuario.rol !== 'ADMIN') throw new ForbiddenException('Solo el administrador puede gestionar el catálogo de cuentas.')
    if (!permiso) throw new BadRequestException('Acción desconocida.')
    if (usuario.rol !== 'ADMIN' && !usuario.accesos.includes(permiso)) throw new ForbiddenException('No tiene permiso para esta acción contable.')
    const datos = body.datos ?? {}
    if (Array.isArray(datos) || typeof datos !== 'object') throw new BadRequestException('Los datos deben ser un objeto.')
    if (!['importar','crear_periodo','crear_cuenta'].includes(body.accion) && (!Number.isSafeInteger(Number(datos.periodoId)) || Number(datos.periodoId)<=0)) throw new BadRequestException('Seleccione un período válido.')
    if (['contabilizar','descartar','revertir'].includes(body.accion) && (!Number.isSafeInteger(Number(datos.id)) || Number(datos.id)<=0)) throw new BadRequestException('Seleccione una partida válida.')
    if (body.accion === 'guardar') {
      if (!Array.isArray(datos.lineas)) throw new BadRequestException('Ingrese las líneas de la partida.')
      try { validarPartida(datos.lineas) } catch (error) { throw new BadRequestException((error as Error).message) }
    }
    const empresa = await getEmpresaPrincipal()
    const result = await supabaseAdmin.rpc('cont_operar', { p_empresa: empresa.empresaId, p_usuario: usuario.usuarioId, p_accion: body.accion, p_datos: datos })
    if (result.error) rpcError(result.error)
    const avisos: string[] = []
    if (body.accion === 'publicar') {
      const { data } = await supabaseAdmin.from('cont_periodo').select('anio').eq('id', datos.periodoId).eq('empresa_id', empresa.empresaId).single()
      if (data) for (const anio of [Number(data.anio), Number(data.anio) + 1]) {
        try { avisos.push(...(await recalcularRatios(empresa.empresaId, anio)).avisos) }
        catch { avisos.push(`Los estados se publicaron. Los indicadores de ${anio} están pendientes de recálculo.`) }
      }
    }
    return NextResponse.json({ ...result.data, avisos })
  })
}
