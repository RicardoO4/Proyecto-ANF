// POST /api/v1/resumen-ia — "Resumen con IA" de cada pantalla de análisis (Módulo E).
//
// Body: { tipo, datos, forzar? }
//   tipo  ∈ comparativo | ratios | evolucion | equilibrio | dupont |
//           proyeccion | pronostico | proforma
//   datos = los parámetros de esa pantalla (ver lib/resumenIA.ts)
//
// Fuera de /api/v1/analisis a propósito: basta una sesión válida (igual que
// para VER cualquier análisis), así un usuario de Proyecciones también puede
// pedir el resumen de su proyección. Solo lee la base de datos.
import { NextResponse } from 'next/server'
import { BadRequestException, handle } from '@/lib/errors'
import { GeminiError } from '@/lib/gemini'
import { resumirAnalisis, TIPOS_RESUMEN, type TipoResumen } from '@/lib/resumenIA'

// Gemini puede tardar varios segundos en responder.
export const maxDuration = 60

const MAX_BYTES = 8_000 // los datos de una pantalla nunca son más grandes

export async function POST(req: Request) {
  return handle(req, async () => {
    const texto = await req.text()
    if (texto.length > MAX_BYTES) throw new BadRequestException('Los datos enviados son demasiado grandes.')

    let body: { tipo?: unknown; datos?: unknown; forzar?: unknown }
    try {
      body = JSON.parse(texto)
    } catch {
      throw new BadRequestException('El cuerpo de la petición debe ser JSON.')
    }

    const tipo = String(body.tipo ?? '') as TipoResumen
    if (!TIPOS_RESUMEN.includes(tipo)) {
      throw new BadRequestException(`Tipo de análisis no válido: '${tipo}'.`)
    }
    const datos =
      body.datos && typeof body.datos === 'object' && !Array.isArray(body.datos)
        ? (body.datos as Record<string, unknown>)
        : {}

    try {
      return NextResponse.json(await resumirAnalisis(tipo, datos, body.forzar === true))
    } catch (err) {
      if (!(err instanceof GeminiError)) throw err
      console.error('[Resumen IA]', tipo, err.message, err.causa ?? '')
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
