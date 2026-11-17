// /api/v1/analisis/asistente-ia — Asistente Financiero IA (Módulo E).
//
// GET  ?empresaId=2                       → { anios: [2025, 2024, 2023] }
//      años con ratios calculados (lectura: basta una sesión válida).
// POST { empresaId, anio, forzar? }       → AsistenteRespuesta
//      lectura en lenguaje sencillo generada por Gemini. Requiere el acceso
//      del módulo de Análisis (opción 2), según lib/permisos.ts.
//
// La ruta solo lee la base de datos; no guarda nada.
import { NextResponse } from 'next/server'
import { BadRequestException, handle } from '@/lib/errors'
import { GeminiError } from '@/lib/gemini'
import { aniosConRatios, interpretarRatios } from '@/lib/asistenteFinanciero'

// Gemini puede tardar varios segundos en responder.
export const maxDuration = 60

function enteroPositivo(valor: unknown, campo: string): number {
  const n = Number(valor)
  if (!Number.isInteger(n) || n <= 0) {
    throw new BadRequestException(`El campo '${campo}' es obligatorio y debe ser un número entero.`)
  }
  return n
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const empresaId = enteroPositivo(new URL(req.url).searchParams.get('empresaId'), 'empresaId')
    return NextResponse.json({ anios: await aniosConRatios(empresaId) })
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json().catch(() => null)) as {
      empresaId?: unknown
      anio?: unknown
      forzar?: unknown
    } | null
    if (!body) throw new BadRequestException('El cuerpo de la petición debe ser JSON.')

    const empresaId = enteroPositivo(body.empresaId, 'empresaId')
    const anio = enteroPositivo(body.anio, 'anio')

    try {
      const respuesta = await interpretarRatios(empresaId, anio, body.forzar === true)
      return NextResponse.json(respuesta)
    } catch (err) {
      if (!(err instanceof GeminiError)) throw err
      // Mismo formato de error que el resto de la API, con un mensaje útil.
      console.error('[Asistente IA]', err.message, err.causa ?? '')
      return NextResponse.json(
        {
          timestamp: new Date().toISOString(),
          status: err.status,
          error: 'Asistente IA no disponible',
          message: err.message,
          path: new URL(req.url).pathname,
        },
        { status: err.status },
      )
    }
  })
}
