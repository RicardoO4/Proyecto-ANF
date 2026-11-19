// Piezas compartidas del Asistente IA (Módulo E): formato de respuesta,
// instrucciones base y caché para ahorrar tokens de la versión gratuita.
import { createHash } from 'node:crypto'
import { conCachePersistente } from '@/lib/cacheIA'
import { generarJsonConGemini, modeloGemini, GeminiError, type TokensUsados } from '@/lib/gemini'

export type EstadoGeneral = 'saludable' | 'atencion' | 'riesgo'

export interface InterpretacionIA {
  estadoGeneral: EstadoGeneral
  resumen: string
  explicacionPorArea: { area: string; explicacion: string }[]
  puntosFuertes: string[]
  alertas: string[]
  recomendaciones: string[]
  glosario: { termino: string; definicion: string }[]
}

/** Datos comunes de toda respuesta de IA que llega a la pantalla. */
export interface MetaIA {
  modelo: string
  generadoEn: string
  desdeCache: boolean
  tokens: TokensUsados
}

// ---------------------------------------------------------------
// Instrucciones y formato (cortos a propósito: cada palabra son tokens)
// ---------------------------------------------------------------

export const INSTRUCCIONES_BASE = `Eres un asistente financiero que explica resultados a personas sin formación en finanzas, en El Salvador.
Reglas:
- Español sencillo, frases cortas, trato de "usted". Sé breve.
- Usa SOLO los datos dados; no inventes cifras ni causas. Copia los números tal como aparecen.
- Explica con ejemplos cotidianos ("por cada dólar que debe, tiene 40 centavos").
- Si usas un término técnico, defínelo en el glosario en una frase.
- Si un dato no permite lectura normal (patrimonio negativo, valor en cero), dilo y explica qué significa.
- Recomendaciones orientativas y generales; no des asesoría de inversión ni prometas resultados.
- estadoGeneral: "saludable" sin riesgos graves; "riesgo" con problemas serios de liquidez, deuda o pérdidas; "atencion" en otro caso.`

export const ESQUEMA_RESPUESTA = {
  type: 'object',
  properties: {
    estadoGeneral: { type: 'string', enum: ['saludable', 'atencion', 'riesgo'] },
    resumen: { type: 'string', description: '2 a 4 frases.' },
    explicacionPorArea: {
      type: 'array',
      description: 'Máximo 4 entradas, 1 a 3 frases cada una.',
      items: {
        type: 'object',
        properties: { area: { type: 'string' }, explicacion: { type: 'string' } },
        required: ['area', 'explicacion'],
      },
    },
    puntosFuertes: { type: 'array', items: { type: 'string' }, description: 'Máximo 3, una frase cada uno.' },
    alertas: { type: 'array', items: { type: 'string' }, description: 'Máximo 3, de la más grave a la menos.' },
    recomendaciones: { type: 'array', items: { type: 'string' }, description: 'Máximo 3 acciones concretas.' },
    glosario: {
      type: 'array',
      description: 'Máximo 4 términos.',
      items: {
        type: 'object',
        properties: { termino: { type: 'string' }, definicion: { type: 'string' } },
        required: ['termino', 'definicion'],
      },
    },
  },
  required: ['estadoGeneral', 'resumen', 'explicacionPorArea', 'puntosFuertes', 'alertas', 'recomendaciones', 'glosario'],
}

export function normalizarInterpretacion(r: Partial<InterpretacionIA>): InterpretacionIA {
  const lista = (v: unknown, max: number) =>
    (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []).slice(0, max)
  const estado: EstadoGeneral =
    r.estadoGeneral === 'saludable' || r.estadoGeneral === 'riesgo' ? r.estadoGeneral : 'atencion'
  return {
    estadoGeneral: estado,
    resumen: typeof r.resumen === 'string' ? r.resumen : '',
    explicacionPorArea: (Array.isArray(r.explicacionPorArea) ? r.explicacionPorArea : [])
      .filter((a) => a && typeof a.area === 'string' && typeof a.explicacion === 'string')
      .slice(0, 6),
    puntosFuertes: lista(r.puntosFuertes, 4),
    alertas: lista(r.alertas, 4),
    recomendaciones: lista(r.recomendaciones, 4),
    glosario: (Array.isArray(r.glosario) ? r.glosario : [])
      .filter((g) => g && typeof g.termino === 'string' && typeof g.definicion === 'string')
      .slice(0, 6),
  }
}

// ---------------------------------------------------------------
// Caché: el mismo análisis con los mismos datos no gasta tokens otra vez
// ---------------------------------------------------------------

/** Full hash: includes context, model, prompt, schema and input data. */
export function huella(valor: unknown): string {
  return createHash('sha256').update(JSON.stringify(valor)).digest('hex')
}

/** Durable across deployments; explicit regeneration is protected by SQL. */
export async function interpretarConCache(
  clave: string, mensaje: string, forzar = false,
): Promise<{ interpretacion: InterpretacionIA; meta: MetaIA }> {
  const modelo = modeloGemini()
  const hash = huella({ version: 1, modelo, clave, mensaje, instrucciones: INSTRUCCIONES_BASE, esquema: ESQUEMA_RESPUESTA })
  return conCachePersistente(hash, modelo, forzar, async () => {
    const { datos, tokens } = await generarJsonConGemini<Partial<InterpretacionIA>>({
      instrucciones: INSTRUCCIONES_BASE, mensaje, esquemaRespuesta: ESQUEMA_RESPUESTA,
    })
    if (!datos || typeof datos.resumen !== 'string' || !datos.resumen.trim()) {
      throw new GeminiError('Gemini no devolvi\u00f3 una explicaci\u00f3n v\u00e1lida. No se guard\u00f3 la respuesta.', 502)
    }
    return { interpretacion: normalizarInterpretacion(datos), meta: { modelo, generadoEn: new Date().toISOString(), tokens } }
  })
}

// ---------------------------------------------------------------
// Formato de números para los mensajes (cortos = menos tokens)
// ---------------------------------------------------------------

const fmtEntero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const fmtDos = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export const dinero = (v: number) => `$${fmtEntero.format(v)}`
export const num = (v: number) => fmtDos.format(v)
export const pct = (v: number) => `${fmtDos.format(v)}%`
