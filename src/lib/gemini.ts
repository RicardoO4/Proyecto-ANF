// Cliente de Google Gemini (Módulo E — Asistente IA), con el SDK oficial
// @google/genai (versión fijada 2.32.0 en package.json).
//
// Variables de entorno (.env.local):
//   GEMINI_API_KEY   clave creada en Google AI Studio (obligatoria)
//   GEMINI_MODEL     modelo a usar (opcional, por defecto gemini-3.5-flash-lite)
//
// Importar solo desde Route Handlers: la clave no lleva prefijo
// NEXT_PUBLIC_, así que Next.js nunca la incluye en el código del navegador.
//
// Ahorro de tokens (versión gratuita):
//   - maxOutputTokens limita el largo de cada respuesta.
//   - Se desactiva el "pensamiento" del modelo (sus tokens también cuentan);
//     si el modelo no admite esa opción, se reintenta una vez sin ella y se
//     recuerda para no volver a fallar.
//   - Cada llamada registra en la terminal los tokens usados.
import { ApiError, GoogleGenAI } from '@google/genai'

const MODELO_POR_DEFECTO = 'gemini-3.5-flash-lite'
const TIEMPO_LIMITE_MS = 30_000
const MAX_TOKENS_SALIDA = 900

/**
 * Error de la conexión con Gemini. Lleva el código HTTP que debe devolver
 * nuestra API y un mensaje en español apto para mostrar al usuario.
 */
export class GeminiError extends Error {
  constructor(
    message: string,
    public status: number,
    public causa?: unknown,
  ) {
    super(message)
    this.name = 'GeminiError'
  }
}

export interface GeminiPeticion {
  /** Instrucciones de rol y reglas (system instruction). */
  instrucciones: string
  /** Mensaje del usuario con los datos a analizar. */
  mensaje: string
  /** JSON Schema que debe cumplir la respuesta. */
  esquemaRespuesta: Record<string, unknown>
  /** 0 = respuestas más estables; 1 = más variadas. */
  temperatura?: number
  /** Tope de tokens de la respuesta (por defecto 900). */
  maxTokensSalida?: number
}

export interface TokensUsados {
  entrada: number
  salida: number
  total: number
}

export function modeloGemini(): string {
  return process.env.GEMINI_MODEL?.trim() || MODELO_POR_DEFECTO
}

// Un solo cliente por proceso; se recrea si cambia la clave.
let cliente: { apiKey: string; ai: GoogleGenAI } | null = null
// Modelos que rechazaron desactivar el pensamiento.
const sinOpcionPensamiento = new Set<string>()

function obtenerCliente(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    throw new GeminiError(
      'El asistente IA no está configurado: falta GEMINI_API_KEY en .env.local.',
      503,
    )
  }
  if (!cliente || cliente.apiKey !== apiKey) {
    cliente = { apiKey, ai: new GoogleGenAI({ apiKey }) }
  }
  return cliente.ai
}

/**
 * Envía la petición a Gemini y devuelve la respuesta ya convertida desde
 * JSON, junto con los tokens usados. Lanza GeminiError con un mensaje
 * claro en cada caso de fallo.
 */
export async function generarJsonConGemini<T>(
  peticion: GeminiPeticion,
): Promise<{ datos: T; tokens: TokensUsados }> {
  const ai = obtenerCliente()
  const modelo = modeloGemini()

  const llamar = (conPensamientoApagado: boolean) =>
    ai.models.generateContent({
      model: modelo,
      contents: peticion.mensaje,
      config: {
        systemInstruction: peticion.instrucciones,
        temperature: peticion.temperatura ?? 0.3,
        maxOutputTokens: peticion.maxTokensSalida ?? MAX_TOKENS_SALIDA,
        responseMimeType: 'application/json',
        responseJsonSchema: peticion.esquemaRespuesta,
        ...(conPensamientoApagado ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        abortSignal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      },
    })

  let texto: string | undefined
  let tokens: TokensUsados
  try {
    let respuesta
    const pensamientoApagado = !sinOpcionPensamiento.has(modelo)
    try {
      respuesta = await llamar(pensamientoApagado)
    } catch (err) {
      // Algunos modelos no permiten apagar el pensamiento y responden 400
      // (un 400 no gasta tokens). Se reintenta una vez sin esa opción y,
      // si así funciona, se recuerda para las siguientes llamadas.
      if (pensamientoApagado && err instanceof ApiError && err.status === 400) {
        console.warn(`[Gemini] ${modelo} rechazó apagar el pensamiento; se reintenta sin esa opción.`)
        respuesta = await llamar(false)
        sinOpcionPensamiento.add(modelo)
      } else {
        throw err
      }
    }

    if (respuesta.promptFeedback?.blockReason) {
      throw new GeminiError(
        'Gemini rechazó generar la explicación para estos datos. Intente de nuevo.',
        502,
        respuesta.promptFeedback,
      )
    }

    const uso = respuesta.usageMetadata
    tokens = {
      entrada: uso?.promptTokenCount ?? 0,
      salida: (uso?.candidatesTokenCount ?? 0) + (uso?.thoughtsTokenCount ?? 0),
      total: uso?.totalTokenCount ?? 0,
    }
    console.info(
      `[Gemini] ${modelo} · tokens entrada ${tokens.entrada}, salida ${tokens.salida}, total ${tokens.total}`,
    )

    if (respuesta.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      throw new GeminiError(
        'La explicación quedó incompleta por el límite de tokens. Intente de nuevo.',
        502,
      )
    }
    texto = respuesta.text?.trim()
  } catch (err) {
    throw traducirError(err, modelo)
  }

  if (!texto) {
    throw new GeminiError('Gemini devolvió una respuesta vacía. Intente de nuevo.', 502)
  }

  try {
    return { datos: JSON.parse(texto) as T, tokens }
  } catch (err) {
    throw new GeminiError(
      'La respuesta de Gemini no tiene el formato esperado. Intente de nuevo.',
      502,
      err,
    )
  }
}

function traducirError(err: unknown, modelo: string): GeminiError {
  if (err instanceof GeminiError) return err

  if (err instanceof ApiError) {
    console.error(`[Gemini] error ${err.status}: ${err.message}`)
    return new GeminiError(
      `${mensajeSegunEstado(err.status, modelo)} Detalle de Google: ${detalleGoogle(err.message)}`,
      502,
      err.message,
    )
  }

  const nombre = err instanceof Error ? err.name : ''
  if (nombre === 'TimeoutError' || nombre === 'AbortError') {
    return new GeminiError(
      'Gemini tardó demasiado en responder. Intente de nuevo en unos segundos.',
      504,
      err,
    )
  }
  return new GeminiError(
    'No se pudo conectar con Gemini. Revise su conexión a internet.',
    504,
    err,
  )
}

/** Extrae el texto del error de Google (sus mensajes no incluyen la clave). */
function detalleGoogle(mensaje: string): string {
  let texto = mensaje
  try {
    const inicio = mensaje.indexOf('{')
    if (inicio >= 0) {
      const json = JSON.parse(mensaje.slice(inicio)) as { error?: { message?: string } }
      texto = json.error?.message ?? mensaje
    }
  } catch {
    // no era JSON: se usa el texto tal cual
  }
  return texto.replace(/\s+/g, ' ').trim().slice(0, 300)
}

function mensajeSegunEstado(status: number, modelo: string): string {
  if (status === 400) return 'Gemini rechazó la petición.'
  if (status === 401 || status === 403) {
    return 'La clave de Gemini no es válida o no tiene permiso. Revise GEMINI_API_KEY.'
  }
  if (status === 404) return `El modelo "${modelo}" no existe en Gemini. Revise GEMINI_MODEL.`
  if (status === 429) {
    return 'Se alcanzó el límite gratuito de Gemini. Espere un minuto e intente de nuevo.'
  }
  return 'Gemini no está disponible en este momento. Intente de nuevo más tarde.'
}
