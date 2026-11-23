// Guardar, abrir, listar y borrar documentos del Módulo E en Supabase:
// presupuestos (E1-E2) y evaluaciones de capital (E3). Tablas creadas por
// supabase/migrations/007_presupuestos.sql.
//
// Solo se guardan los DATOS DE ENTRADA; los resultados se recalculan al
// abrir. Si la migración 007 todavía no se ejecutó, todas las operaciones
// responden 503 con el mensaje "Falta crear las tablas (migración 007)".
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, BusinessRuleException, NotFoundException } from '@/lib/errors'
import { validarSupuestos, type SupuestosPresupuesto } from '@/lib/presupuesto'
import { validarCapital, type SupuestosCapital } from '@/lib/capital'

const MAX_BYTES = 64_000
const MENSAJE_SIN_TABLAS =
  'Falta crear las tablas (migración 007). Pida al administrador que ejecute supabase/migrations/007_presupuestos.sql.'

export interface ConfigDocumento {
  tabla: 'presupuesto' | 'evaluacion_capital'
  columnaId: 'id_presupuesto' | 'id_evaluacion'
  columnaDatos: 'supuestos' | 'datos'
  conAnio: boolean
  /** Devuelve los errores de validación y, si aplica, el año. */
  validar: (datos: unknown) => { errores: string[]; anio?: number }
}

export const CONFIG_PRESUPUESTO: ConfigDocumento = {
  tabla: 'presupuesto',
  columnaId: 'id_presupuesto',
  columnaDatos: 'supuestos',
  conAnio: true,
  validar: (datos) => {
    try {
      const s = datos as SupuestosPresupuesto
      const errores = validarSupuestos(s)
      if (!Number.isInteger(s.anio) || s.anio < 1900 || s.anio > 2200) errores.push('El año del presupuesto no es válido.')
      return { errores, anio: s.anio }
    } catch {
      return { errores: ['Los supuestos del presupuesto no tienen el formato esperado.'] }
    }
  },
}

export const CONFIG_CAPITAL: ConfigDocumento = {
  tabla: 'evaluacion_capital',
  columnaId: 'id_evaluacion',
  columnaDatos: 'datos',
  conAnio: false,
  validar: (datos) => {
    try {
      return { errores: validarCapital(datos as SupuestosCapital) }
    } catch {
      return { errores: ['Los datos de los proyectos no tienen el formato esperado.'] }
    }
  },
}

// ---------------------------------------------------------------
// Errores de base de datos
// ---------------------------------------------------------------

class TablasFaltantes extends Error {}

type ErrorSupabase = { code?: string; message?: string } | null

/** Convierte los errores de Supabase en excepciones con mensaje claro. */
function revisarError(error: ErrorSupabase): void {
  if (!error) return
  const msg = error.message ?? ''
  if (error.code === 'PGRST205' || error.code === '42P01' || /could not find the table|does not exist/i.test(msg)) {
    throw new TablasFaltantes(MENSAJE_SIN_TABLAS)
  }
  if (error.code === '23505') throw new BusinessRuleException('Ya existe un documento con ese nombre. Use otro nombre.')
  if (error.code === '23503') throw new BadRequestException('La empresa indicada no existe.')
  throw error
}

/** Envuelve una operación: si faltan las tablas responde 503 con el mensaje de la migración. */
export async function conTablas(req: Request, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (err) {
    if (!(err instanceof TablasFaltantes)) throw err
    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        status: 503,
        error: 'Service Unavailable',
        message: err.message,
        path: new URL(req.url).pathname,
      },
      { status: 503 },
    )
  }
}

// ---------------------------------------------------------------
// Lectura y validación de entradas
// ---------------------------------------------------------------

function idValido(valor: unknown, campo: string): number {
  const n = Number(valor)
  if (!Number.isInteger(n) || n <= 0) throw new BadRequestException(`El dato '${campo}' debe ser un número entero.`)
  return n
}

async function leerCuerpo(req: Request): Promise<{ nombre?: unknown; empresaId?: unknown; datos?: unknown }> {
  const texto = await req.text()
  if (texto.length > MAX_BYTES) throw new BadRequestException('Los datos enviados son demasiado grandes.')
  try {
    const body: unknown = JSON.parse(texto)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Objeto requerido')
    return body as { nombre?: unknown; empresaId?: unknown; datos?: unknown }
  } catch {
    throw new BadRequestException('El cuerpo de la petición debe ser JSON.')
  }
}

function nombreValido(valor: unknown): string {
  const nombre = typeof valor === 'string' ? valor.trim() : ''
  if (nombre.length === 0 || nombre.length > 100) {
    throw new BadRequestException('El nombre es obligatorio y debe tener como máximo 100 caracteres.')
  }
  return nombre
}

function datosValidos(cfg: ConfigDocumento, datos: unknown): { anio?: number } {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new BadRequestException('Faltan los datos a guardar.')
  }
  const { errores, anio } = cfg.validar(datos)
  if (errores.length > 0) throw new BadRequestException(`No se puede guardar: ${errores.join(' ')}`)
  return { anio }
}

/** Usuario de la sesión (la caché de permisos.ts evita otra consulta). */
async function usuarioActual(req: Request): Promise<number> {
  const { autorizar } = await import('@/lib/permisos')
  return (await autorizar(req)).usuarioId
}

type Fila = Record<string, unknown>

function aResumen(cfg: ConfigDocumento, f: Fila) {
  return {
    id: Number(f[cfg.columnaId]),
    nombre: String(f.nombre),
    ...(cfg.conAnio ? { anio: Number(f.anio) } : {}),
    creadoEn: f.creado_en as string,
    actualizadoEn: f.actualizado_en as string,
  }
}

const columnasResumen = (cfg: ConfigDocumento) =>
  `${cfg.columnaId}, nombre, ${cfg.conAnio ? 'anio, ' : ''}creado_en, actualizado_en`

// ---------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------

/** GET ?empresaId= → lista (más reciente primero), sin los datos. */
export async function listarDocumentos(cfg: ConfigDocumento, req: Request): Promise<Response> {
  const empresaId = idValido(new URL(req.url).searchParams.get('empresaId'), 'empresaId')
  const { data, error } = await supabaseAdmin
    .from(cfg.tabla)
    .select(columnasResumen(cfg))
    .eq('empresa_id', empresaId)
    .order('actualizado_en', { ascending: false })
  revisarError(error)
  return NextResponse.json(((data ?? []) as unknown as Fila[]).map((f) => aResumen(cfg, f)))
}

/** GET /[id] → documento con sus datos. */
export async function obtenerDocumento(cfg: ConfigDocumento, req: Request, idTexto: string): Promise<Response> {
  const id = idValido(idTexto, 'id')
  const { data, error } = await supabaseAdmin
    .from(cfg.tabla)
    .select(`${columnasResumen(cfg)}, ${cfg.columnaDatos}`)
    .eq(cfg.columnaId, id)
    .maybeSingle()
  revisarError(error)
  if (!data) throw new NotFoundException('El documento no existe o fue borrado.')
  const fila = data as unknown as Fila
  return NextResponse.json({ ...aResumen(cfg, fila), datos: fila[cfg.columnaDatos] })
}

/** POST { empresaId, nombre, datos } → crea (409 si el nombre ya existe). */
export async function crearDocumento(cfg: ConfigDocumento, req: Request): Promise<Response> {
  const body = await leerCuerpo(req)
  const empresaId = idValido(body.empresaId, 'empresaId')
  const nombre = nombreValido(body.nombre)
  const { anio } = datosValidos(cfg, body.datos)
  const usuarioId = await usuarioActual(req)

  const { data, error } = await supabaseAdmin
    .from(cfg.tabla)
    .insert({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      nombre,
      ...(cfg.conAnio ? { anio } : {}),
      [cfg.columnaDatos]: body.datos,
    })
    .select(columnasResumen(cfg))
    .single()
  revisarError(error)
  return NextResponse.json(aResumen(cfg, data as unknown as Fila), { status: 201 })
}

/** PUT /[id] { nombre?, datos } → actualiza los datos (y el nombre, si viene). */
export async function actualizarDocumento(cfg: ConfigDocumento, req: Request, idTexto: string): Promise<Response> {
  const id = idValido(idTexto, 'id')
  const body = await leerCuerpo(req)
  const { anio } = datosValidos(cfg, body.datos)
  const cambios: Fila = {
    [cfg.columnaDatos]: body.datos,
    ...(cfg.conAnio ? { anio } : {}),
    actualizado_en: new Date().toISOString(),
  }
  if (body.nombre !== undefined) cambios.nombre = nombreValido(body.nombre)

  const { data, error } = await supabaseAdmin
    .from(cfg.tabla)
    .update(cambios)
    .eq(cfg.columnaId, id)
    .select(columnasResumen(cfg))
    .maybeSingle()
  revisarError(error)
  if (!data) throw new NotFoundException('El documento no existe o fue borrado.')
  return NextResponse.json(aResumen(cfg, data as unknown as Fila))
}

/** DELETE /[id] */
export async function eliminarDocumento(cfg: ConfigDocumento, req: Request, idTexto: string): Promise<Response> {
  const id = idValido(idTexto, 'id')
  const { data, error } = await supabaseAdmin
    .from(cfg.tabla)
    .delete()
    .eq(cfg.columnaId, id)
    .select(cfg.columnaId)
  revisarError(error)
  if (!data || data.length === 0) throw new NotFoundException('El documento no existe o ya fue borrado.')
  return new NextResponse(null, { status: 204 })
}
