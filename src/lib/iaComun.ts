// Piezas compartidas del Asistente IA (Módulo E): formato de respuesta,
// instrucciones base y caché para ahorrar tokens de la versión gratuita.
import { createHash } from 'node:crypto'
import { generarJsonConGemini, modeloGemini, type TokensUsados } from '@/lib/gemini'

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

const CACHE_MS = 6 * 60 * 60 * 1000 // 6 horas
const ESPERA_REGENERAR_MS = 60 * 1000 // "Volver a generar" como mucho 1 vez por minuto
const MAX_ENTRADAS = 100

interface EntradaCache {
  interpretacion: InterpretacionIA
  meta: Omit<MetaIA, 'desdeCache'>
  creado: number
}

const cache = new Map<string, EntradaCache>()
const enCurso = new Map<string, Promise<EntradaCache>>()

/** Huella corta de los datos: si los datos cambian, cambia la clave. */
export function huella(valor: unknown): string {
  return createHash('sha256').update(JSON.stringify(valor)).digest('hex').slice(0, 16)
}

/**
 * Devuelve la interpretación de `mensaje`, usando la caché cuando puede.
 * - Misma clave dentro de 6 h → no llama a Gemini.
 * - `forzar` solo vuelve a llamar si la entrada tiene más de 1 minuto.
 * - Dos pedidos iguales al mismo tiempo comparten una sola llamada.
 */
export async function interpretarConCache(
  clave: string,
  mensaje: string,
  forzar = false,
): Promise<{ interpretacion: InterpretacionIA; meta: MetaIA }> {
  const claveCompleta = `${modeloGemini()}|${clave}|${huella(mensaje)}`
  const guardado = cache.get(claveCompleta)
  const edad = guardado ? Date.now() - guardado.creado : Infinity

  const usarGuardado = guardado && edad < CACHE_MS && (!forzar || edad < ESPERA_REGENERAR_MS)
  if (usarGuardado) {
    return { interpretacion: guardado.interpretacion, meta: { ...guardado.meta, desdeCache: true } }
  }

  let pendiente = enCurso.get(claveCompleta)
  if (!pendiente) {
    pendiente = (async () => {
      const { datos, tokens } = await generarJsonConGemini<Partial<InterpretacionIA>>({
        instrucciones: INSTRUCCIONES_BASE,
        mensaje,
        esquemaRespuesta: ESQUEMA_RESPUESTA,
      })
      const entrada: EntradaCache = {
        interpretacion: normalizarInterpretacion(datos),
        meta: { modelo: modeloGemini(), generadoEn: new Date().toISOString(), tokens },
        creado: Date.now(),
      }
      if (cache.size >= MAX_ENTRADAS) cache.delete(cache.keys().next().value as string)
      cache.set(claveCompleta, entrada)
      return entrada
    })().finally(() => enCurso.delete(claveCompleta))
    enCurso.set(claveCompleta, pendiente)
  }

  const entrada = await pendiente
  return { interpretacion: entrada.interpretacion, meta: { ...entrada.meta, desdeCache: false } }
}

// ---------------------------------------------------------------
// Formato de números para los mensajes (cortos = menos tokens)
// ---------------------------------------------------------------

const fmtEntero = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const fmtDos = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export const dinero = (v: number) => `$${fmtEntero.format(v)}`
export const num = (v: number) => fmtDos.format(v)
export const pct = (v: number) => `${fmtDos.format(v)}%`
