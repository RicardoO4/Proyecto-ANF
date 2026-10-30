// Ratio calculators — faithful port of RatioService (9 hardcoded endpoints).
// Each calculator: validate the ratio's category, sum saldo values from the
// financial statements by cuenta code, compute, compare against the sector
// benchmark, generate the Spanish interpretation, persist and return.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { InternalException, NotFoundException } from '@/lib/errors'
import type { RatioResponseDTO } from '@/types'

// ---------------------------------------------------------------
// constants — account codes exactly as in the Java service
// ---------------------------------------------------------------
const ACTIVO_CORRIENTE = ['1401', '1402', '1403', '1404', '1405', '1406']
const PASIVO_CORRIENTE = ['2401', '2402', '2403', '240401', '240402', '240403']
const ACTIVOS_TOTALES = ['1401', '1402', '1403', '1404', '1405', '1406', '120401', '1407', '120106']
const EFECTIVO = ['1401', '1403']
const VENTAS_NETAS = ['510201']
const VENTAS_BRUTAS = ['510201', '510202', '510203', '510204', '510205']
const COSTO_VENTAS = ['410201', '410202', '410203', '410204', '410303']
const GASTOS_OPERATIVOS = ['430101', '420212']
const ACTIVOS_FIJOS = ['120106']

type MetricInput = {
  empresaId: number
  anio: number
  tipoReporte: string
  codigos: string[]
}

/** SUM(saldo) filtered by empresa, year, report type and account codes. */
export async function sumSaldos(input: MetricInput): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from('linea_estado_financiero')
    .select(
      'saldo, estado_financiero!inner(empresa_id, anio, tipo_reporte), cuenta!inner(cue_cuenta_id)',
    )
    .eq('estado_financiero.empresa_id', input.empresaId)
    .eq('estado_financiero.anio', input.anio)
    .eq('estado_financiero.tipo_reporte', input.tipoReporte)
    .in('cuenta.cue_cuenta_id', input.codigos)
  if (error) throw error
  return (data ?? []).reduce((sum, row) => sum + Number((row as { saldo: number }).saldo), 0)
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
      'id_ratio, anio_ratio, periodo_ratio, empresa_id, interpretacion, categoriaRatio(id_categoria_ratio, nombre_tipo), parametroSector(id_parametro_sector, valor_referencia, anio_referencia, nombre_ratio)',
    )
    .eq('id_ratio', id)
    .maybeSingle()
  if (error) throw error
  const ratio = data as unknown as RatioEntity | null
  if (!ratio) {
    throw new NotFoundException('Ratio no encontrado')
  }
  return ratio
}

/**
 * Runs one calculator: loads the ratio, validates the category, computes the
 * value with the provided formulas, updates the DB and returns the response.
 */
export async function calculateRatio(
  id: number,
  expectedCategory: string,
  compute: (get: (codes: string[], tipoReporte: string, anio?: number) => Promise<number>) => Promise<{
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
      const activoCorriente = await get(ACTIVO_CORRIENTE, 'BALANCE_GENERAL')
      const pasivoCorriente = await get(PASIVO_CORRIENTE, 'BALANCE_GENERAL')
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
      const activoCorriente = await get(ACTIVO_CORRIENTE, 'BALANCE_GENERAL')
      const pasivoCorriente = await get(PASIVO_CORRIENTE, 'BALANCE_GENERAL')
      const activosTotales = await get(ACTIVOS_TOTALES, 'BALANCE_GENERAL')
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
      const efectivo = await get(EFECTIVO, 'BALANCE_GENERAL')
      const pasivoCorriente = await get(PASIVO_CORRIENTE, 'BALANCE_GENERAL')
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
      const ventasNetas = await get(VENTAS_NETAS, 'ESTADO_RESULTADOS')
      const cxcActual = await get(['1405'], 'BALANCE_GENERAL')
      const cxcAnterior = await get(['1405'], 'BALANCE_GENERAL', anio - 1)
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
      const ventasNetas = await get(VENTAS_NETAS, 'ESTADO_RESULTADOS')
      const cxcActual = await get(['1405'], 'BALANCE_GENERAL')
      const cxcAnterior = await get(['1405'], 'BALANCE_GENERAL', anio - 1)
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
      const ventasNetas = await get(VENTAS_NETAS, 'ESTADO_RESULTADOS')
      const activosActual = await get(ACTIVOS_TOTALES, 'BALANCE_GENERAL')
      const activosAnterior = await get(ACTIVOS_TOTALES, 'BALANCE_GENERAL', anio - 1)
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
      const ventasNetas = await get(VENTAS_NETAS, 'ESTADO_RESULTADOS')
      const activosFijos = await get(ACTIVOS_FIJOS, 'BALANCE_GENERAL')
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
      const ventasBrutas = await get(VENTAS_BRUTAS, 'ESTADO_RESULTADOS')
      const costoVentas = await get(COSTO_VENTAS, 'ESTADO_RESULTADOS')
      const ventasNetas = await get(VENTAS_NETAS, 'ESTADO_RESULTADOS')
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
      const ventasBrutas = await get(VENTAS_BRUTAS, 'ESTADO_RESULTADOS')
      const costoVentas = await get(COSTO_VENTAS, 'ESTADO_RESULTADOS')
      const gastosOperativos = await get(GASTOS_OPERATIVOS, 'ESTADO_RESULTADOS')
      const ventasNetas = await get(VENTAS_NETAS, 'ESTADO_RESULTADOS')
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
