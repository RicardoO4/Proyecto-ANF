import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { GeminiError } from '@/lib/gemini'
import type { InterpretacionIA, MetaIA } from '@/lib/iaComun'

export interface ContenidoCacheIA { interpretacion: InterpretacionIA; meta: Omit<MetaIA, 'desdeCache'> }
type Reserva = { estado: 'guardado'; contenido: ContenidoCacheIA } | { estado: 'generar' | 'esperar' }
const LIMITE_ESPERA_MS = 20_000
const INTERVALO_MS = 500
const falloAlmacenamiento = () => new GeminiError('No se pudo acceder al guardado de IA. Verifique la migración 010_cache_ia_persistente.sql en Supabase. No se consultó Gemini.', 503)

/** La reserva SQL evita generar simultáneamente el mismo análisis en varias instancias. */
export async function conCachePersistente(
  clave: string, modelo: string, forzar: boolean, generar: () => Promise<ContenidoCacheIA>,
): Promise<{ interpretacion: InterpretacionIA; meta: MetaIA }> {
  const propietario = randomUUID()
  const inicio = Date.now()
  for (;;) {
    const { data, error } = await supabaseAdmin.rpc('reservar_cache_ia', {
      p_clave: clave, p_modelo: modelo, p_propietario: propietario, p_forzar: forzar,
    })
    if (error || !data) throw falloAlmacenamiento()
    const reserva = data as Reserva
    if (reserva.estado === 'guardado') {
      if (!reserva.contenido?.interpretacion?.resumen || !reserva.contenido.meta?.generadoEn) throw falloAlmacenamiento()
      return { ...reserva.contenido, meta: { ...reserva.contenido.meta, desdeCache: true } }
    }
    if (reserva.estado === 'esperar') {
      if (Date.now() - inicio >= LIMITE_ESPERA_MS) throw new GeminiError('Este análisis ya se está generando. Espere unos segundos y vuelva a abrirlo; no se inició otra consulta a Gemini.', 503)
      await new Promise(resolve => setTimeout(resolve, INTERVALO_MS))
      continue
    }
    if (reserva.estado !== 'generar') throw falloAlmacenamiento()
    let generada = false
    try {
      const contenido = await generar()
      generada = true
      const { data: guardado, error: errorGuardar } = await supabaseAdmin.from('ia_cache').update({
        contenido, generado_en: contenido.meta.generadoEn, propietario: null, reservado_hasta: null, actualizado_en: new Date().toISOString(),
      }).eq('clave', clave).eq('propietario', propietario).select('clave').maybeSingle()
      if (errorGuardar || !guardado) {
        // Mantener la reserva evita una segunda generación inmediata si falla el guardado.
        throw new GeminiError('La explicación se generó, pero no pudo guardarse. Espere y revise Supabase antes de solicitar otra para evitar consumo adicional.', 503)
      }
      return { ...contenido, meta: { ...contenido.meta, desdeCache: false } }
    } catch (errorGeneracion) {
      // Ante errores de generación, liberar la reserva; nunca guardar el error como respuesta.
      // Si falló el guardado tras generar, conservar la reserva hasta su vencimiento.
      if (!generada) {
        try { await supabaseAdmin.from('ia_cache').update({ propietario: null, reservado_hasta: null }).eq('clave', clave).eq('propietario', propietario) }
        catch { /* La reserva vence sola aunque Supabase no responda. */ }
      }
      if (generada && !(errorGeneracion instanceof GeminiError)) throw new GeminiError('La explicación se generó, pero no pudo guardarse. Revise Supabase antes de solicitar otra.', 503)
      throw errorGeneracion
    }
  }
}
