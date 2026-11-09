// Ratio calculators — faithful port of RatioService (9 hardcoded endpoints).
// Each calculator: validate the ratio's category, sum saldo values from the
// financial statements by cuenta code, compute, compare against the sector
// benchmark, generate the Spanish interpretation, persist and return.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { InternalException, NotFoundException } from '@/lib/errors'
import type { RatioResponseDTO } from '@/types'

// ---------------------------------------------------------------
// constants — account codes imported from the single source of truth
// (Módulo B, tarea B1). Each value is a PREFIX of the real chart of
// accounts (FINAN II 2025); sumSaldos matches by prefix, not equality.
// ---------------------------------------------------------------
import {
  ACTIVO_CORRIENTE,
  PASIVO_CORRIENTE,
  ACTIVO_TOTAL as ACTIVOS_TOTALES,
  EFECTIVO,
  TIPO_REPORTE,
  VENTAS_NETAS,
  VENTAS_BRUTAS,
  COSTO_VENTAS,
  GASTOS_OPERATIVOS,
  ACTIVOS_FIJOS,
  CUENTAS_POR_COBRAR,
} from '@/lib/accountCodes'
import type { TipoReporte } from '@/lib/accountCodes'

type PrefixCodes = string | string[]

type MetricInput = {
  empresaId: number
  anio: number
  tipoReporte: TipoReporte
  codigos: PrefixCodes
}

/**
 * SUM(saldo) filtered by empresa, year, report type and account codes.
 * Each code is a PREFIX: every line whose cue_cuenta_id starts with it is
 * summed. A code starting with '-' is subtracted (e.g. Ventas Netas =
 * 5101.01 − 5101.02). No is_postable filter: uploaded rows are parent
 * codes with rolled-up balances.
 */
export async function sumSaldos(input: MetricInput): Promise<number> {
  const codigos = Array.isArray(input.codigos) ? input.codigos : [input.codigos]
  let total = 0
  for (const entry of codigos) {
    const resta = entry.startsWith('-')
    const prefijo = resta ? entry.slice(1) : entry
    const { data, error } = await supabaseAdmin
      .from('linea_estado_financiero')
      .select(
        'saldo, estado_financiero!inner(empresa_id, anio, tipo_reporte), cuenta!inner(cue_cuenta_id)',
      )
      .eq('estado_financiero.empresa_id', input.empresaId)
      .eq('estado_financiero.anio', input.anio)
      .eq('estado_financiero.tipo_reporte', input.tipoReporte)
      .like('cuenta.cue_cuenta_id', `${prefijo}%`)
    if (error) throw error
    const suma = (data ?? []).reduce(
      (sum, row) => sum + Number((row as { saldo: number }).saldo),
      0,
    )
    total += resta ? -suma : suma
  }
  return total
}

function round(value: number, scale: number): number {
  const factor = Math.pow(10, scale)
  return Math.round(value * factor) / factor
}

interface RatioEntity {
  id_ratio: number
  anio_ratio: number | null
  periodo_ratio: string | null
  empresa_id: number
  interpretacion: string | null
  categoriaRatio: { id_categoria_ratio: number; nombre_tipo: string } | null
  parametroSector: {
    id_parametro_sector: number
    valor_referencia: number
    anio_referencia: number | null
    nombre_ratio: string
  } | null
}

export async function loadRatio(id: number): Promise<RatioEntity> {
  const { data, error } = await supabaseAdmin
    .from('ratio')
    .select(
      // PostgREST resuelve embeds por NOMBRE DE TABLA (los FK apuntan a
      // categoria_ratio / parametro_sector); alias tipo "categoriaRatio(...)"
      // lanzan PGRST200 y rompían los 9 endpoints de cálculo.
      'id_ratio, anio_ratio, periodo_ratio, empresa_id, interpretacion, categoria_ratio(id_categoria_ratio, nombre_tipo), parametro_sector(id_parametro_sector, valor_referencia, anio_referencia, nombre_ratio)',
    )
    .eq('id_ratio', id)
    .maybeSingle()
  if (error) throw error
  const row = data as unknown as
    | {
        id_ratio: number
        anio_ratio: number | null
        periodo_ratio: string | null
        empresa_id: number
        interpretacion: string | null
        categoria_ratio: { id_categoria_ratio: number; nombre_tipo: string } | null
        parametro_sector: {
          id_parametro_sector: number
          valor_referencia: number
          anio_referencia: number | null
          nombre_ratio: string
        } | null
      }
    | null
  if (!row) {
    throw new NotFoundException('Ratio no encontrado')
  }
  // El embed llega con el nombre de la tabla; se expone con las llaves
  // camelCase que usan calculateRatio y los 9 calculadores.
  const { categoria_ratio, parametro_sector, ...scalars } = row
  return {
    ...scalars,
    categoriaRatio: categoria_ratio ?? null,
    parametroSector: parametro_sector ?? null,
  }
}

/**
 * Runs one calculator: loads the ratio, validates the category, computes the
 * value with the provided formulas, updates the DB and returns the response.
 */
export async function calculateRatio(
  id: number,
  expectedCategory: string,
  compute: (get: (codes: string | string[], tipoReporte: TipoReporte, anio?: number) => Promise<number>) => Promise<{
    valor: number
    cumple: boolean
    interpretacion: string
  }>,
): Promise<Response> {
  const ratio = await loadRatio(id)
  if (ratio.categoriaRatio?.nombre_tipo !== expectedCategory) {
    // IllegalStateException → 500 in Java
    throw new InternalException(
      `El ratio con ID ${id} no pertenece a la categoría "${expectedCategory}".`,
    )
  }
  if (!ratio.anio_ratio) {
    throw new InternalException('El ratio no tiene un año de análisis definido.')
  }

  const { valor, cumple, interpretacion } = await compute((codigos, tipoReporte, anio) =>
    sumSaldos({
      empresaId: ratio.empresa_id,
      anio: anio ?? ratio.anio_ratio!,
      tipoReporte,
      codigos,
    }),
  )

  const valorSector = ratio.parametroSector?.valor_referencia
  if (valorSector == null) {
    throw new InternalException('El ratio no tiene un parámetro de sector asociado.')
  }
  const diferencia = round(valor - Number(valorSector), 4)

  const { data: updated, error } = await supabaseAdmin
    .from('ratio')
    .update({
      valor_calculado: valor,
      valor_sector_promedio: Number(valorSector),
      diferencia_vs_sector: diferencia,
      cumple_sector: cumple,
      interpretacion,
    })
    .eq('id_ratio', id)
    .select()
    .single()
  if (error) throw error

  const response = await mapRatioResponse(updated)
  return Response.json(response, { status: 200 })
}

/** Full RatioResponseDTO mapper (empresa/categoria/parametro nested shapes). */
export async function mapRatioResponse(row: {
  id_ratio: number
  anio_ratio: number | null
  periodo_ratio: string | null
  valor_calculado: number | null
  valor_sector_promedio: number | null
  diferencia_vs_sector: number | null
  cumple_sector: boolean | null
  interpretacion: string | null
  empresa_id: number
  id_categoria_ratio: number | null
  id_parametro_sector: number | null
}): Promise<RatioResponseDTO> {
  const [empresaRes, categoriaRes, parametroRes] = await Promise.all([
    supabaseAdmin
      .from('empresa')
      .select('empresa_id, nombre_empresa')
      .eq('empresa_id', row.empresa_id)
      .maybeSingle(),
    row.id_categoria_ratio
      ? supabaseAdmin.from('categoria_ratio').select('*').eq('id_categoria_ratio', row.id_categoria_ratio).maybeSingle()
      : Promise.resolve({ data: null }),
    row.id_parametro_sector
      ? supabaseAdmin.from('parametro_sector').select('*').eq('id_parametro_sector', row.id_parametro_sector).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const empresa = (empresaRes.data as { empresa_id: number; nombre_empresa: string } | null) ?? null
  const categoria = (categoriaRes.data as { id_categoria_ratio: number; nombre_tipo: string } | null) ?? null
  const parametro = (parametroRes.data as { id_parametro_sector: number; valor_referencia: number; anio_referencia: number | null; nombre_ratio: string } | null) ?? null

  return {
    id_ratio: row.id_ratio,
    anio_ratio: row.anio_ratio,
    periodo_ratio: row.periodo_ratio,
    valor_calculado: row.valor_calculado == null ? null : Number(row.valor_calculado),
    valor_sector_promedio: row.valor_sector_promedio == null ? null : Number(row.valor_sector_promedio),
    diferencia_vs_sector: row.diferencia_vs_sector == null ? null : Number(row.diferencia_vs_sector),
    cumple_sector: row.cumple_sector,
    interpretacion: row.interpretacion,
    empresa: {
      empresa_id: empresa?.empresa_id ?? row.empresa_id,
      nombre_empresa: empresa?.nombre_empresa ?? '',
    },
    categoriaRatio: categoria
      ? { id_categoria_ratio: categoria.id_categoria_ratio, nombre_categoria: categoria.nombre_tipo }
      : null,
    parametroSector: parametro
      ? {
          id_parametro_sector: parametro.id_parametro_sector,
          valor_referencia: Number(parametro.valor_referencia),
          anio_referencia: parametro.anio_referencia,
          nombreRatio: parametro.nombre_ratio,
        }
      : null,
  }
}

const f2 = (v: number) => v.toFixed(2)

/**
 * Individual calculators. Each returns a handler() bound to calculateRatio
 * with its exact expected category name and formula.
 */

export function calcularLiquidez(id: number) {
  return calculateRatio(
    id,
    'Razón de circulante o liquidez corriente',
    async (get) => {
      const activoCorriente = await get(ACTIVO_CORRIENTE, TIPO_REPORTE.BALANCE)
      const pasivoCorriente = await get(PASIVO_CORRIENTE, TIPO_REPORTE.BALANCE)
      const valor = pasivoCorriente !== 0 ? round(activoCorriente / pasivoCorriente, 4) : 0
      const ratio = await loadRatio(id)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const posicion = cumple ? 'por encima' : 'por debajo'
      return {
        valor,
        cumple,
        interpretacion: `La empresa dispone de ${f2(activoCorriente)} USD de activo corriente por cada dólar de deuda a corto plazo. Este valor se encuentra ${posicion} del benchmark del sector, que es de ${f2(ref)}.`,
      }
    },
  )
}

export function calcularCapitalTrabajo(id: number) {
  return calculateRatio(
    id,
    'Razón de capital de trabajo',
    async (get) => {
      const activoCorriente = await get(ACTIVO_CORRIENTE, TIPO_REPORTE.BALANCE)
      const pasivoCorriente = await get(PASIVO_CORRIENTE, TIPO_REPORTE.BALANCE)
      const activosTotales = await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE)
      const capitalTrabajo = activoCorriente - pasivoCorriente
      const valor = activosTotales !== 0 ? round(capitalTrabajo / activosTotales, 4) : 0
      const ratio = await loadRatio(id)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const posicion = cumple ? 'por encima' : 'por debajo'
      return {
        valor,
        cumple,
        interpretacion: `La empresa genera ${f2(valor * 100)} centavos de capital de trabajo neto por cada dólar de activos totales, lo cual se encuentra ${posicion} del benchmark del sector (${f2(ref)}).`,
      }
    },
  )
}

export function calcularEfectivo(id: number) {
  return calculateRatio(
    id,
    'Razón de efectivo',
    async (get) => {
      const efectivo = await get(EFECTIVO, TIPO_REPORTE.BALANCE)
      const pasivoCorriente = await get(PASIVO_CORRIENTE, TIPO_REPORTE.BALANCE)
      const valor = pasivoCorriente !== 0 ? round(efectivo / pasivoCorriente, 4) : 0
      const ratio = await loadRatio(id)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const nivel = cumple ? 'saludable y por encima' : 'reducido y por debajo'
      return {
        valor,
        cumple,
        interpretacion: `El nivel de liquidez inmediata es ${nivel} del benchmark del sector, que es de ${f2(ref)}.`,
      }
    },
  )
}

export function calcularRotacionCuentasPorCobrar(id: number) {
  return calculateRatio(
    id,
    'Razón de rotación de cuentas por cobrar',
    async (get) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const cxcActual = await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE)
      const cxcAnterior = await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE, anio - 1)
      const promedioCxc = (cxcActual + cxcAnterior) / 2
      const valor = promedioCxc !== 0 ? round(ventasNetas / promedioCxc, 4) : 0
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const posicion = cumple ? 'eficiente' : 'lenta'
      return {
        valor,
        cumple,
        interpretacion: `La empresa cobra sus cuentas por cobrar ${f2(valor)} veces al año, una gestión ${posicion} en comparación con el benchmark del sector de ${f2(ref)} veces.`,
      }
    },
  )
}

export function calcularPeriodoCobranza(id: number) {
  return calculateRatio(
    id,
    'Período medio de cobranza',
    async (get) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const cxcActual = await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE)
      const cxcAnterior = await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE, anio - 1)
      const promedioCxc = (cxcActual + cxcAnterior) / 2
      // NOTE: scale 2 (not 4) for this ratio, as in the Java implementation
      const valor = ventasNetas !== 0 ? round((promedioCxc * 365) / ventasNetas, 2) : 0
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor <= ref // lower is better!
      return {
        valor,
        cumple,
        interpretacion: `La empresa tarda en promedio ${f2(valor)} días en cobrar sus cuentas por cobrar, un plazo que se considera ${cumple ? 'adecuado' : 'excesivo'} frente al benchmark del sector de ${f2(ref)} días.`,
      }
    },
  )
}

export function calcularRotacionActivosTotales(id: number) {
  return calculateRatio(
    id,
    'Índice de rotación de activos totales',
    async (get) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const activosActual = await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE)
      const activosAnterior = await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE, anio - 1)
      const promedioActivos = (activosActual + activosAnterior) / 2
      const valor = promedioActivos !== 0 ? round(ventasNetas / promedioActivos, 4) : 0
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const posicion = cumple ? 'por encima' : 'por debajo'
      return {
        valor,
        cumple,
        interpretacion: `Cada dólar invertido en activos genera ${f2(valor)} dólares de ventas, un desempeño ${posicion} del benchmark del sector de ${f2(ref)}.`,
      }
    },
  )
}

export function calcularRotacionActivosFijos(id: number) {
  return calculateRatio(
    id,
    'Índice de rotación de activos fijos',
    async (get) => {
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const activosFijos = await get(ACTIVOS_FIJOS, TIPO_REPORTE.BALANCE)
      const valor = activosFijos !== 0 ? round(ventasNetas / activosFijos, 4) : 0
      const ratio = await loadRatio(id)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const posicion = cumple ? 'por encima' : 'por debajo'
      return {
        valor,
        cumple,
        interpretacion: `Cada dólar invertido en activos fijos genera ${f2(valor)} dólares de ventas, un desempeño ${posicion} del benchmark del sector de ${f2(ref)}.`,
      }
    },
  )
}

export function calcularMargenBruto(id: number) {
  return calculateRatio(
    id,
    'Índice de margen bruto',
    async (get) => {
      const ventasBrutas = await get(VENTAS_BRUTAS, TIPO_REPORTE.RESULTADOS)
      const costoVentas = await get(COSTO_VENTAS, TIPO_REPORTE.RESULTADOS)
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const valor = ventasNetas !== 0 ? round((ventasBrutas - costoVentas) / ventasNetas, 4) : 0
      const ratio = await loadRatio(id)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const posicion = cumple ? 'por encima' : 'por debajo'
      return {
        valor,
        cumple,
        interpretacion: `Por cada dólar de ventas, la empresa retiene ${f2(valor * 100)} centavos como utilidad bruta, un margen ${posicion} del benchmark del sector de ${f2(ref * 100)}%.`,
      }
    },
  )
}

export function calcularMargenOperativo(id: number) {
  return calculateRatio(
    id,
    'Índice de margen operativo',
    async (get) => {
      const ventasBrutas = await get(VENTAS_BRUTAS, TIPO_REPORTE.RESULTADOS)
      const costoVentas = await get(COSTO_VENTAS, TIPO_REPORTE.RESULTADOS)
      const gastosOperativos = await get(GASTOS_OPERATIVOS, TIPO_REPORTE.RESULTADOS)
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const valor =
        ventasNetas !== 0 ? round((ventasBrutas - costoVentas - gastosOperativos) / ventasNetas, 4) : 0
      const ratio = await loadRatio(id)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const posicion = cumple ? 'eficiente' : 'comprometida'
      return {
        valor,
        cumple,
        interpretacion: `Por cada dólar de ventas, la empresa genera ${f2(valor * 100)} centavos de utilidad operativa; una gestión ${posicion} en comparación con el benchmark del sector de ${f2(ref * 100)}%.`,
      }
    },
  )
}
