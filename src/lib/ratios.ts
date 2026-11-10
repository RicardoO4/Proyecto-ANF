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
  INVENTARIOS,
  PASIVO_TOTAL,
  PATRIMONIO_TOTAL,
  CUENTAS_POR_PAGAR,
  GASTOS_FINANCIEROS,
  RESULTADO_EJERCICIO,
  TOTAL_INGRESOS,
  TOTAL_COSTOS_GASTOS,
} from '@/lib/accountCodes'
import type { TipoReporte } from '@/lib/accountCodes'
// Fórmulas puras (Módulo C): compartidas con scripts/verify-ratios.mts.
import {
  analisisDuPont,
  cicloConversionEfectivo,
  cicloOperativo,
  coberturaIntereses,
  edadPromedioInventario,
  endeudamientoPatrimonial,
  gradoEndeudamiento,
  gradoPropiedad,
  margenNeto,
  periodoMedioPago,
  promedioSaldo,
  pruebaAcida,
  roa,
  roe,
  rotacionInventario,
} from '@/lib/ratioFormulas'

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
 *
 * `tieneEstado(anio, tipo)` distingue "el año no está cargado" de "el saldo
 * es cero". Sin esa distinción, promediar contra un año ausente reduce el
 * denominador a la mitad y duplica la rotación en silencio.
 */
export async function calculateRatio(
  id: number,
  expectedCategory: string,
  compute: (
    get: (codes: string | string[], tipoReporte: TipoReporte, anio?: number) => Promise<number>,
    tieneEstado: (anio: number, tipoReporte: TipoReporte) => Promise<boolean>,
  ) => Promise<{
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

  const { valor, cumple, interpretacion } = await compute(
    (codigos, tipoReporte, anio) =>
      sumSaldos({
        empresaId: ratio.empresa_id,
        anio: anio ?? ratio.anio_ratio!,
        tipoReporte,
        codigos,
      }),
    async (anio, tipoReporte) => {
      const { count, error } = await supabaseAdmin
        .from('estado_financiero')
        .select('id_estado_financiero', { count: 'exact', head: true })
        .eq('empresa_id', ratio.empresa_id)
        .eq('anio', anio)
        .eq('tipo_reporte', tipoReporte)
      if (error) throw error
      return (count ?? 0) > 0
    },
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
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const cxcActual = await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE)
      const cxcAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioCxc = promedioSaldo(cxcActual, cxcAnterior)
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
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const cxcActual = await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE)
      const cxcAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioCxc = promedioSaldo(cxcActual, cxcAnterior)
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
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const activosActual = await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE)
      const activosAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioActivos = promedioSaldo(activosActual, activosAnterior)
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

// ---------------------------------------------------------------
// Módulo C — C1: liquidez complementaria y apalancamiento.
// Las fórmulas viven en lib/ratioFormulas.ts; acá solo se leen los
// saldos, se compara contra el benchmark y se redacta la
// interpretación (la columna `interpretacion` es VARCHAR(256)).
// ---------------------------------------------------------------

export function calcularPruebaAcida(id: number) {
  return calculateRatio(
    id,
    'Prueba ácida',
    async (get) => {
      const ratio = await loadRatio(id)
      const activoCorriente = await get(ACTIVO_CORRIENTE, TIPO_REPORTE.BALANCE)
      const inventario = await get(INVENTARIOS, TIPO_REPORTE.BALANCE)
      const pasivoCorriente = await get(PASIVO_CORRIENTE, TIPO_REPORTE.BALANCE)
      if (pasivoCorriente === 0) {
        throw new InternalException(
          'El Pasivo Corriente es cero: no se puede calcular la prueba ácida. Verifique el Balance General del año.',
        )
      }
      const valor = pruebaAcida(activoCorriente, inventario, pasivoCorriente)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const posicion = cumple ? 'por encima' : 'por debajo'
      return {
        valor,
        cumple,
        interpretacion: `Sin contar el inventario, la empresa dispone de ${f2(valor)} dólares de activos líquidos por cada dólar de pasivo corriente; se ubica ${posicion} del benchmark del sector (${f2(ref)}).`,
      }
    },
  )
}

export function calcularGradoEndeudamiento(id: number) {
  return calculateRatio(
    id,
    'Grado de endeudamiento',
    async (get) => {
      const ratio = await loadRatio(id)
      const activoTotal = await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE)
      const pasivoTotal = await get(PASIVO_TOTAL, TIPO_REPORTE.BALANCE)
      if (activoTotal === 0) {
        throw new InternalException(
          'El Activo Total es cero: no se puede calcular el grado de endeudamiento. Verifique el Balance General del año.',
        )
      }
      const valor = gradoEndeudamiento(pasivoTotal, activoTotal)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor <= ref // menor es mejor
      const posicion = cumple ? 'por debajo' : 'por encima'
      return {
        valor,
        cumple,
        interpretacion: `El ${f2(valor * 100)}% del activo total está financiado con pasivos; la empresa se ubica ${posicion} del benchmark del sector (${f2(ref * 100)}%), donde un valor menor indica menor dependencia de terceros.`,
      }
    },
  )
}

export function calcularGradoPropiedad(id: number) {
  return calculateRatio(
    id,
    'Grado de propiedad',
    async (get) => {
      const ratio = await loadRatio(id)
      const activoTotal = await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE)
      const patrimonio = await get(PATRIMONIO_TOTAL, TIPO_REPORTE.BALANCE)
      if (activoTotal === 0) {
        throw new InternalException(
          'El Activo Total es cero: no se puede calcular el grado de propiedad. Verifique el Balance General del año.',
        )
      }
      const valor = gradoPropiedad(patrimonio, activoTotal)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      // Con patrimonio negativo el ratio pierde sentido: se marca incumplido
      // aunque la comparación numérica pudiera dar positivo.
      const cumple = patrimonio > 0 && valor >= ref
      const interpretacion =
        patrimonio < 0
          ? `El patrimonio es negativo (${f2(patrimonio)} USD): el capital propio no cubre las obligaciones y el indicador no admite una lectura normal de solvencia.`
          : `El ${f2(valor * 100)}% del activo total pertenece a los dueños; la empresa se ubica ${cumple ? 'por encima' : 'por debajo'} del benchmark del sector (${f2(ref * 100)}%).`
      return { valor, cumple, interpretacion }
    },
  )
}

export function calcularEndeudamientoPatrimonial(id: number) {
  return calculateRatio(
    id,
    'Razón de endeudamiento patrimonial',
    async (get) => {
      const ratio = await loadRatio(id)
      const pasivoTotal = await get(PASIVO_TOTAL, TIPO_REPORTE.BALANCE)
      const patrimonio = await get(PATRIMONIO_TOTAL, TIPO_REPORTE.BALANCE)
      if (patrimonio === 0) {
        throw new InternalException(
          'El Patrimonio es cero: la razón pasivo/patrimonio no está definida. Verifique el Balance General del año.',
        )
      }
      const valor = endeudamientoPatrimonial(pasivoTotal, patrimonio)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = patrimonio > 0 && valor <= ref // menor es mejor
      const interpretacion =
        patrimonio < 0
          ? `El patrimonio es negativo (${f2(patrimonio)} USD), por lo que la razón pasivo/patrimonio no es interpretable: la empresa está técnicamente insolvente.`
          : `Por cada dólar de patrimonio la empresa debe ${f2(valor)} dólares a terceros; se ubica ${cumple ? 'por debajo' : 'por encima'} del benchmark del sector (${f2(ref)}).`
      return { valor, cumple, interpretacion }
    },
  )
}

// ---------------------------------------------------------------
// Módulo C — C1: Apalancamiento faltante (Cobertura de Intereses)
// ---------------------------------------------------------------

export function calcularCoberturaIntereses(id: number) {
  return calculateRatio(
    id,
    'Razón de cobertura de intereses',
    async (get) => {
      const ratio = await loadRatio(id)
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const costoVentas = await get(COSTO_VENTAS, TIPO_REPORTE.RESULTADOS)
      const gastosOperativos = await get(GASTOS_OPERATIVOS, TIPO_REPORTE.RESULTADOS)
      const gastosFinancieros = await get(GASTOS_FINANCIEROS, TIPO_REPORTE.RESULTADOS)
      const ebit = ventasNetas - costoVentas - gastosOperativos
      if (gastosFinancieros === 0) {
        return {
          valor: 0,
          cumple: true,
          interpretacion:
            'La empresa no reporta gastos financieros en el ejercicio, por lo que no incurre en costos fijos de deuda.',
        }
      }
      const valor = coberturaIntereses(ebit, gastosFinancieros)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const interpretacion = `La empresa genera ${f2(valor)} veces su gasto financiero mediante su utilidad operativa; se ubica ${cumple ? 'por encima' : 'por debajo'} del benchmark del sector (${f2(ref)} veces).`
      return { valor, cumple, interpretacion }
    },
  )
}

// ---------------------------------------------------------------
// Módulo C — C2: Rentabilidad (Margen Neto, ROA, ROE, DuPont)
// ---------------------------------------------------------------

export function calcularMargenNeto(id: number) {
  return calculateRatio(
    id,
    'Índice de margen neto',
    async (get) => {
      const ratio = await loadRatio(id)
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const totalIngresos = await get(TOTAL_INGRESOS, TIPO_REPORTE.RESULTADOS)
      const totalCostosGastos = await get(TOTAL_COSTOS_GASTOS, TIPO_REPORTE.RESULTADOS)
      const utilidadNeta =
        totalIngresos > 0 ? totalIngresos - totalCostosGastos : await get(RESULTADO_EJERCICIO, TIPO_REPORTE.BALANCE)
      if (ventasNetas === 0) {
        throw new InternalException('Las Ventas Netas son cero o no se encuentran registradas en el Estado de Resultados.')
      }
      const valor = margenNeto(utilidadNeta, ventasNetas)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const interpretacion = `Por cada dólar de ventas, la empresa retiene ${f2(valor * 100)} centavos como utilidad neta (${f2(valor * 100)}%); un margen ${cumple ? 'por encima' : 'por debajo'} del benchmark del sector (${f2(ref * 100)}%).`
      return { valor, cumple, interpretacion }
    },
  )
}

export function calcularROA(id: number) {
  return calculateRatio(
    id,
    'Rendimiento sobre activos (ROA)',
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const totalIngresos = await get(TOTAL_INGRESOS, TIPO_REPORTE.RESULTADOS)
      const totalCostosGastos = await get(TOTAL_COSTOS_GASTOS, TIPO_REPORTE.RESULTADOS)
      const utilidadNeta =
        totalIngresos > 0 ? totalIngresos - totalCostosGastos : await get(RESULTADO_EJERCICIO, TIPO_REPORTE.BALANCE)
      const activosActual = await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE)
      const activosAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioActivos = promedioSaldo(activosActual, activosAnterior)
      if (promedioActivos === 0) {
        throw new InternalException('El Activo Total es cero: no se puede calcular el ROA.')
      }
      const valor = roa(utilidadNeta, promedioActivos)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const interpretacion = `Cada dólar invertido en activos generó ${f2(valor * 100)} centavos de utilidad neta (${f2(valor * 100)}% de ROA), situándose ${cumple ? 'por encima' : 'por debajo'} del benchmark del sector (${f2(ref * 100)}%).`
      return { valor, cumple, interpretacion }
    },
  )
}

export function calcularROE(id: number) {
  return calculateRatio(
    id,
    'Rendimiento sobre capital contable (ROE)',
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const totalIngresos = await get(TOTAL_INGRESOS, TIPO_REPORTE.RESULTADOS)
      const totalCostosGastos = await get(TOTAL_COSTOS_GASTOS, TIPO_REPORTE.RESULTADOS)
      const utilidadNeta =
        totalIngresos > 0 ? totalIngresos - totalCostosGastos : await get(RESULTADO_EJERCICIO, TIPO_REPORTE.BALANCE)
      const patrimonioActual = await get(PATRIMONIO_TOTAL, TIPO_REPORTE.BALANCE)
      const patrimonioAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(PATRIMONIO_TOTAL, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioPatrimonio = promedioSaldo(patrimonioActual, patrimonioAnterior)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      if (patrimonioActual <= 0) {
        const valor = patrimonioActual !== 0 ? roe(utilidadNeta, patrimonioActual) : 0
        return {
          valor,
          cumple: false,
          interpretacion: `El patrimonio es negativo (${f2(patrimonioActual)} USD): la empresa se encuentra en quiebra técnica y el ROE no es interpretable normalmente.`,
        }
      }
      const valor = roe(utilidadNeta, promedioPatrimonio)
      const cumple = valor >= ref
      const interpretacion = `Por cada dólar de patrimonio aportado por los accionistas se genera ${f2(valor * 100)}% de retorno neto; situándose ${cumple ? 'por encima' : 'por debajo'} del benchmark del sector (${f2(ref * 100)}%).`
      return { valor, cumple, interpretacion }
    },
  )
}

export function calcularAnalisisDuPont(id: number) {
  return calculateRatio(
    id,
    'Análisis DuPont',
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const totalIngresos = await get(TOTAL_INGRESOS, TIPO_REPORTE.RESULTADOS)
      const totalCostosGastos = await get(TOTAL_COSTOS_GASTOS, TIPO_REPORTE.RESULTADOS)
      const utilidadNeta =
        totalIngresos > 0 ? totalIngresos - totalCostosGastos : await get(RESULTADO_EJERCICIO, TIPO_REPORTE.BALANCE)
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const activosActual = await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE)
      const activosAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(ACTIVOS_TOTALES, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioActivos = promedioSaldo(activosActual, activosAnterior)
      const patrimonioActual = await get(PATRIMONIO_TOTAL, TIPO_REPORTE.BALANCE)
      const patrimonioAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(PATRIMONIO_TOTAL, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioPatrimonio = promedioSaldo(patrimonioActual, patrimonioAnterior)

      const mNeto = ventasNetas !== 0 ? utilidadNeta / ventasNetas : 0
      const rotAct = promedioActivos !== 0 ? ventasNetas / promedioActivos : 0
      const multCap = promedioPatrimonio > 0 ? promedioActivos / promedioPatrimonio : 0
      const valor = analisisDuPont(mNeto, rotAct, multCap)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const interpretacion = `DuPont: Margen Neto ${f2(mNeto * 100)}% × Rotación ${f2(rotAct)}x × Multiplicador Capital ${f2(multCap)}x = ROE ${f2(valor * 100)}%; frente al benchmark de ${f2(ref * 100)}%.`
      return { valor, cumple, interpretacion }
    },
  )
}

// ---------------------------------------------------------------
// Módulo C — C3: Ciclos Operativos (Inventario, Pago, CO, CCE)
// ---------------------------------------------------------------

export function calcularRotacionInventarios(id: number) {
  return calculateRatio(
    id,
    'Razón de rotación de inventarios',
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const costoVentas = await get(COSTO_VENTAS, TIPO_REPORTE.RESULTADOS)
      const invActual = await get(INVENTARIOS, TIPO_REPORTE.BALANCE)
      const invAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(INVENTARIOS, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioInv = promedioSaldo(invActual, invAnterior)
      const valor = rotacionInventario(costoVentas, promedioInv)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref
      const interpretacion = `El inventario rotó ${f2(valor)} veces en el año, un desempeño ${cumple ? 'eficiente' : 'lento'} frente al benchmark del sector (${f2(ref)} veces).`
      return { valor, cumple, interpretacion }
    },
  )
}

export function calcularEdadPromedioInventario(id: number) {
  return calculateRatio(
    id,
    'Edad promedio del inventario',
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const costoVentas = await get(COSTO_VENTAS, TIPO_REPORTE.RESULTADOS)
      const invActual = await get(INVENTARIOS, TIPO_REPORTE.BALANCE)
      const invAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(INVENTARIOS, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioInv = promedioSaldo(invActual, invAnterior)
      const valor = edadPromedioInventario(promedioInv, costoVentas)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor <= ref // menor es mejor
      const interpretacion = `La empresa tarda en promedio ${f2(valor)} días en vender sus existencias (EPI), un plazo ${cumple ? 'óptimo' : 'excesivo'} frente al benchmark del sector (${f2(ref)} días).`
      return { valor, cumple, interpretacion }
    },
  )
}

export function calcularPeriodoMedioPago(id: number) {
  return calculateRatio(
    id,
    'Período medio de pago',
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const costoVentas = await get(COSTO_VENTAS, TIPO_REPORTE.RESULTADOS)
      const cxpActual = await get(CUENTAS_POR_PAGAR, TIPO_REPORTE.BALANCE)
      const cxpAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(CUENTAS_POR_PAGAR, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioCxp = promedioSaldo(cxpActual, cxpAnterior)
      const valor = periodoMedioPago(promedioCxp, costoVentas)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor >= ref // mayor es mejor para financiamiento espontáneo
      const interpretacion = `La empresa tarda en promedio ${f2(valor)} días en cancelar sus deudas a proveedores (PPP), frente al benchmark del sector de ${f2(ref)} días.`
      return { valor, cumple, interpretacion }
    },
  )
}

export function calcularCicloOperativo(id: number) {
  return calculateRatio(
    id,
    'Ciclo operativo',
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const costoVentas = await get(COSTO_VENTAS, TIPO_REPORTE.RESULTADOS)
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const invActual = await get(INVENTARIOS, TIPO_REPORTE.BALANCE)
      const invAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(INVENTARIOS, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioInv = promedioSaldo(invActual, invAnterior)
      const cxcActual = await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE)
      const cxcAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioCxc = promedioSaldo(cxcActual, cxcAnterior)
      const epi = edadPromedioInventario(promedioInv, costoVentas)
      const ppc = ventasNetas !== 0 ? round((promedioCxc * 365) / ventasNetas, 2) : 0
      const valor = cicloOperativo(epi, ppc)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor <= ref // menor es mejor
      const interpretacion = `El ciclo operativo es de ${f2(valor)} días (EPI: ${f2(epi)} d + PPC: ${f2(ppc)} d); se encuentra ${cumple ? 'por debajo' : 'por encima'} del benchmark del sector (${f2(ref)} días).`
      return { valor, cumple, interpretacion }
    },
  )
}

export function calcularCicloConversionEfectivo(id: number) {
  return calculateRatio(
    id,
    'Ciclo de conversión de efectivo',
    async (get, tieneEstado) => {
      const ratio = await loadRatio(id)
      const anio = ratio.anio_ratio!
      const costoVentas = await get(COSTO_VENTAS, TIPO_REPORTE.RESULTADOS)
      const ventasNetas = await get(VENTAS_NETAS, TIPO_REPORTE.RESULTADOS)
      const invActual = await get(INVENTARIOS, TIPO_REPORTE.BALANCE)
      const invAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(INVENTARIOS, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioInv = promedioSaldo(invActual, invAnterior)
      const cxcActual = await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE)
      const cxcAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(CUENTAS_POR_COBRAR, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioCxc = promedioSaldo(cxcActual, cxcAnterior)
      const cxpActual = await get(CUENTAS_POR_PAGAR, TIPO_REPORTE.BALANCE)
      const cxpAnterior = (await tieneEstado(anio - 1, TIPO_REPORTE.BALANCE))
        ? await get(CUENTAS_POR_PAGAR, TIPO_REPORTE.BALANCE, anio - 1)
        : null
      const promedioCxp = promedioSaldo(cxpActual, cxpAnterior)
      const epi = edadPromedioInventario(promedioInv, costoVentas)
      const ppc = ventasNetas !== 0 ? round((promedioCxc * 365) / ventasNetas, 2) : 0
      const co = cicloOperativo(epi, ppc)
      const ppp = periodoMedioPago(promedioCxp, costoVentas)
      const valor = cicloConversionEfectivo(co, ppp)
      const ref = Number(ratio.parametroSector?.valor_referencia ?? 0)
      const cumple = valor <= ref // menor es mejor
      const interpretacion = `El ciclo de conversión de efectivo (CCE) es de ${f2(valor)} días (Ciclo Operativo ${f2(co)} d − PPP ${f2(ppp)} d); se ubica ${cumple ? 'por debajo' : 'por encima'} del benchmark (${f2(ref)} días).`
      return { valor, cumple, interpretacion }
    },
  )
}

// ---------------------------------------------------------------
// AU1 — recálculo automático tras una carga de estados financieros.
//
// Firma acordada con el Módulo A: `recalcularRatios(empresaId, anio)`.
// Solo recalcula las filas de `ratio` que YA existen para esa empresa y
// año (el catálogo se crea con el seed 003 o desde la UI). Es silencioso
// por diseño: un ratio que no se puede calcular —por ejemplo uno de
// rentabilidad sin Estado de Resultados cargado— no debe hacer fallar la
// carga que lo disparó.
// ---------------------------------------------------------------

const CALCULADORES: Record<string, (id: number) => Promise<Response>> = {
  'Razón de circulante o liquidez corriente': calcularLiquidez,
  'Razón de capital de trabajo': calcularCapitalTrabajo,
  'Razón de efectivo': calcularEfectivo,
  'Razón de rotación de cuentas por cobrar': calcularRotacionCuentasPorCobrar,
  'Período medio de cobranza': calcularPeriodoCobranza,
  'Índice de rotación de activos totales': calcularRotacionActivosTotales,
  'Índice de rotación de activos fijos': calcularRotacionActivosFijos,
  'Índice de margen bruto': calcularMargenBruto,
  'Índice de margen operativo': calcularMargenOperativo,
  'Prueba ácida': calcularPruebaAcida,
  'Grado de endeudamiento': calcularGradoEndeudamiento,
  'Grado de propiedad': calcularGradoPropiedad,
  'Razón de endeudamiento patrimonial': calcularEndeudamientoPatrimonial,
  // C1 - Apalancamiento faltante
  'Razón de cobertura de intereses': calcularCoberturaIntereses,
  // C2 - Rentabilidad
  'Índice de margen neto': calcularMargenNeto,
  'Rendimiento sobre activos (ROA)': calcularROA,
  'Rendimiento sobre capital contable (ROE)': calcularROE,
  'Análisis DuPont': calcularAnalisisDuPont,
  // C3 - Ciclos Operativos
  'Razón de rotación de inventarios': calcularRotacionInventarios,
  'Edad promedio del inventario': calcularEdadPromedioInventario,
  'Período medio de pago': calcularPeriodoMedioPago,
  'Ciclo operativo': calcularCicloOperativo,
  'Ciclo de conversión de efectivo': calcularCicloConversionEfectivo,
}

export async function recalcularRatios(empresaId: number, anio: number): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('ratio')
    .select('id_ratio, categoria_ratio(nombre_tipo)')
    .eq('empresa_id', empresaId)
    .eq('anio_ratio', anio)
  if (error) throw error

  const filas = (data ?? []) as unknown as {
    id_ratio: number
    categoria_ratio: { nombre_tipo: string } | null
  }[]

  for (const fila of filas) {
    const nombre = fila.categoria_ratio?.nombre_tipo
    const calcular = nombre ? CALCULADORES[nombre] : undefined
    if (!calcular) continue
    try {
      await calcular(fila.id_ratio)
    } catch {
      // Silencioso a propósito: la carga ya se completó y el ratio queda
      // pendiente para el próximo recálculo, sin revertir el estado financiero.
    }
  }
}
