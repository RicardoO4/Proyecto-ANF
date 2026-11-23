// Asistente Financiero IA (Módulo E): resumen general de todos los ratios
// calculados de una empresa en un año.
//
// Solo LEE la base de datos. A Gemini se envían los nombres de los ratios
// y sus valores; nunca el nombre de la empresa, NIT ni datos de usuarios.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException } from '@/lib/errors'
import { interpretarConCache, type InterpretacionIA, type MetaIA } from '@/lib/iaComun'

export type { EstadoGeneral, InterpretacionIA, MetaIA } from '@/lib/iaComun'

import { INFO_CATEGORIA, type UnidadRatio } from './ratioMetadatos'
export { INFO_CATEGORIA, type UnidadRatio } from './ratioMetadatos'

export interface RatioParaAsistente {
  nombre: string
  tipo: string
  unidad: UnidadRatio
  menorEsMejor: boolean
  valor: number
  valorSector: number | null
  cumpleSector: boolean | null
  /** Valor y referencia ya formateados, p. ej. "0.40 veces" o "12.50 %". */
  valorTexto: string
  sectorTexto: string | null
}

export interface AsistenteRespuesta extends MetaIA {
  empresaId: number
  anio: number
  ratios: RatioParaAsistente[]
  interpretacion: InterpretacionIA
}

function formatear(valor: number, unidad: UnidadRatio): string {
  if (unidad === 'porcentaje') return `${(valor * 100).toFixed(2)} %`
  if (unidad === 'dias') return `${valor.toFixed(1)} días`
  return `${valor.toFixed(2)} veces`
}

/** Años que tienen al menos un ratio calculado para la empresa (más reciente primero). */
export async function aniosConRatios(empresaId: number): Promise<number[]> {
  const { data, error } = await supabaseAdmin
    .from('ratio')
    .select('anio_ratio')
    .eq('empresa_id', empresaId)
    .not('valor_calculado', 'is', null)
  if (error) throw error
  const anios = new Set(
    (data ?? [])
      .map((r) => Number((r as { anio_ratio: number | null }).anio_ratio))
      .filter((a) => Number.isFinite(a) && a > 0),
  )
  return [...anios].sort((a, b) => b - a)
}

interface FilaRatio {
  valor_calculado: number | string | null
  valor_sector_promedio: number | string | null
  cumple_sector: boolean | null
  categoria_ratio: {
    nombre_tipo: string
    tipo_ratio: { nombre_ratio: string } | null
  } | null
}

/** Ratios calculados de un año, ordenados por tipo y nombre. */
export async function ratiosDelAnio(empresaId: number, anio: number): Promise<RatioParaAsistente[]> {
  const { data, error } = await supabaseAdmin
    .from('ratio')
    .select(
      'valor_calculado, valor_sector_promedio, cumple_sector, categoria_ratio(nombre_tipo, tipo_ratio(nombre_ratio))',
    )
    .eq('empresa_id', empresaId)
    .eq('anio_ratio', anio)
    .not('valor_calculado', 'is', null)
  if (error) throw error

  const ratios = ((data ?? []) as unknown as FilaRatio[])
    .filter((f) => f.categoria_ratio?.nombre_tipo)
    .map((f): RatioParaAsistente => {
      const nombre = f.categoria_ratio!.nombre_tipo
      const info = INFO_CATEGORIA[nombre] ?? { unidad: 'veces' as const, menorEsMejor: false }
      const valor = Number(f.valor_calculado)
      const valorSector = f.valor_sector_promedio == null ? null : Number(f.valor_sector_promedio)
      return {
        nombre,
        tipo: f.categoria_ratio!.tipo_ratio?.nombre_ratio ?? 'Otros',
        unidad: info.unidad,
        menorEsMejor: info.menorEsMejor,
        valor,
        valorSector,
        cumpleSector: f.cumple_sector,
        valorTexto: formatear(valor, info.unidad),
        sectorTexto: valorSector == null ? null : formatear(valorSector, info.unidad),
      }
    })

  return ratios.sort((a, b) => a.tipo.localeCompare(b.tipo, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Mensaje compacto con los ratios de un año, agrupados por tipo. */
export function mensajeRatios(anio: number, ratios: RatioParaAsistente[]): string {
  const tipos = [...new Set(ratios.map((r) => r.tipo))]
  const bloques = tipos.map((tipo) => {
    const lineas = ratios
      .filter((r) => r.tipo === tipo)
      .map((r) => {
        const ref = r.sectorTexto ? `sector ${r.sectorTexto}` : 'sin sector'
        const cumple = r.cumpleSector == null ? '' : r.cumpleSector ? ', cumple' : ', no cumple'
        return `- ${r.nombre}: ${r.valorTexto}; ${ref}${cumple}${r.menorEsMejor ? ' (menor es mejor)' : ''}`
      })
    return `${tipo}:\n${lineas.join('\n')}`
  })
  return `Ratios financieros del año ${anio}:\n${bloques.join('\n')}\nExplica la salud financiera de la empresa.`
}

/** Resumen general de los ratios de un año (página del Asistente IA). */
export async function interpretarRatios(
  empresaId: number,
  anio: number,
  forzar = false,
): Promise<AsistenteRespuesta> {
  const ratios = await ratiosDelAnio(empresaId, anio)
  if (ratios.length === 0) {
    throw new NotFoundException(
      `No hay ratios calculados para el año ${anio}. Calcúlelos primero en el módulo de Ratios.`,
    )
  }

  const { interpretacion, meta } = await interpretarConCache(
    `ratios|${empresaId}|${anio}`,
    mensajeRatios(anio, ratios),
    forzar,
  )
  return { empresaId, anio, ratios, interpretacion, ...meta }
}
