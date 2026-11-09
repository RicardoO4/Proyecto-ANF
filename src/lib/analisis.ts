// Analysis logic — faithful port of AnalisisService.
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { LineaAnalisisDTO, ReporteInternoDTO } from '@/types'
import {
  ACTIVO_CORRIENTE,
  ACTIVO_TOTAL,
  INVENTARIOS,
  PATRIMONIO_TOTAL,
  PASIVO_CORRIENTE,
  PASIVO_TOTAL,
  RESULTADO_EJERCICIO,
  TIPO_REPORTE,
  TOTAL_COSTOS_GASTOS,
  TOTAL_INGRESOS,
  VENTAS_NETAS,
  sumByPrefix,
} from '@/lib/accountCodes'
import type { TipoReporte } from '@/lib/accountCodes'

interface LineaData {
  saldo: number
  nombre: string
}

interface LineaEstadoRow {
  id_linea: number
  saldo: number
  cuenta: {
    cue_cuenta_id: string | null
    nombre_cuenta: string | null
  } | null
}

/**
 * Builds the map `[cue_cuenta_id -> {saldo, nombre}]` for an
 * empresa+anio+tipoReporte (Módulo B, tareas B1 y B2):
 *  - B1: keyed ONLY by cuenta.cue_cuenta_id (the real chart-of-accounts
 *    code), so analisis.ts and ratios.ts measure the same thing.
 *  - B2: filtered by estado_financiero.tipo_reporte, so BALANCE_GENERAL
 *    and ESTADO_RESULTADOS maps are never mixed.
 * name = cuenta.nombreCuenta ?? "Cuenta " + code; duplicates keep the FIRST.
 */
async function getSaldoMap(
  empresaId: number,
  anio: number,
  tipoReporte: TipoReporte,
): Promise<Map<string, LineaData>> {
  const { data, error } = await supabaseAdmin
    .from('linea_estado_financiero')
    .select(
      'id_linea, saldo, estado_financiero!inner(empresa_id, anio, tipo_reporte), cuenta!inner(cue_cuenta_id, nombre_cuenta)',
    )
    .eq('estado_financiero.empresa_id', empresaId)
    .eq('estado_financiero.anio', anio)
    .eq('estado_financiero.tipo_reporte', tipoReporte)
  if (error) throw error

  const map = new Map<string, LineaData>()
  for (const raw of (data ?? []) as unknown as LineaEstadoRow[]) {
    const cuenta = raw.cuenta
    const codigo = cuenta?.cue_cuenta_id?.trim() || raw.id_linea.toString()
    const nombre =
      cuenta?.nombre_cuenta && cuenta.nombre_cuenta.trim() !== ''
        ? cuenta.nombre_cuenta
        : `Cuenta ${codigo}`
    if (!map.has(codigo)) {
      map.set(codigo, { saldo: Number(raw.saldo), nombre })
    }
  }
  return map
}

/** Merges maps (first wins) — used to iterate every line of a year. */
function mergeMaps(...maps: Map<string, LineaData>[]): Map<string, LineaData> {
  const out = new Map<string, LineaData>()
  for (const m of maps) {
    for (const [k, v] of m) {
      if (!out.has(k)) out.set(k, v)
    }
  }
  return out
}

/** Vertical lines of one report type, each % over its own year base (B3). */
function buildVertical(
  map1: Map<string, LineaData>,
  map2: Map<string, LineaData>,
  base1: number,
  base2: number,
  tipoReporte: TipoReporte,
): LineaAnalisisDTO[] {
  const union = new Set<string>([...map1.keys(), ...map2.keys()])
  const lineas: LineaAnalisisDTO[] = []
  for (const codigo of union) {
    const saldo1 = map1.get(codigo)?.saldo ?? 0
    const saldo2 = map2.get(codigo)?.saldo ?? 0
    lineas.push({
      codigoCuenta: codigo,
      nombreCuenta: map2.get(codigo)?.nombre ?? map1.get(codigo)?.nombre ?? 'Cuenta no encontrada',
      saldoAnio1: saldo1,
      saldoAnio2: saldo2,
      variacionAbsoluta: saldo2 - saldo1,
      variacionRelativa: saldo1 !== 0 ? ((saldo2 - saldo1) / saldo1) * 100.0 : 0.0,
      porcentajeVerticalAnio1: base1 !== 0 ? (saldo1 / base1) * 100.0 : 0.0,
      porcentajeVerticalAnio2: base2 !== 0 ? (saldo2 / base2) * 100.0 : 0.0,
      tipoReporte,
    })
  }
  return lineas
}

/**
 * HU-001: reporte interno (análisis horizontal + vertical).
 * Módulo B:
 *  - B2: balance and results are loaded as separate maps.
 *  - B3: the vertical is computed per report type — Balance over Total
 *    Activo, Resultados over Ventas Netas — and returned grouped.
 *    When no Estado de Resultados is loaded yet, the results section is
 *    simply empty (graceful degradation); the balance section still works.
 */
export async function generarReporteInterno(
  empresaId: number,
  anio1: number,
  anio2: number,
): Promise<ReporteInternoDTO> {
  const [bal1, res1, bal2, res2] = await Promise.all([
    getSaldoMap(empresaId, anio1, TIPO_REPORTE.BALANCE),
    getSaldoMap(empresaId, anio1, TIPO_REPORTE.RESULTADOS),
    getSaldoMap(empresaId, anio2, TIPO_REPORTE.BALANCE),
    getSaldoMap(empresaId, anio2, TIPO_REPORTE.RESULTADOS),
  ])

  if (bal1.size === 0 && res1.size === 0 && bal2.size === 0 && res2.size === 0) {
    return { empresaId, anio1, anio2, analisisHorizontal: [], analisisVertical: [] }
  }

  // ---- B3: vertical bases per report type ----
  const baseBal1 = sumByPrefix(bal1, ACTIVO_TOTAL) // Total Activo año 1
  const baseBal2 = sumByPrefix(bal2, ACTIVO_TOTAL) // Total Activo año 2
  const baseRes1 = sumByPrefix(res1, VENTAS_NETAS) // Ventas Netas año 1 (0 sin ER)
  const baseRes2 = sumByPrefix(res2, VENTAS_NETAS) // Ventas Netas año 2 (0 sin ER)

  // ---- Horizontal: union of every line across both report types ----
  const map1 = mergeMaps(bal1, res1)
  const map2 = mergeMaps(bal2, res2)
  const union = new Set<string>([...map1.keys(), ...map2.keys()])
  const horizontal: LineaAnalisisDTO[] = []
  for (const codigo of union) {
    const d1 = map1.get(codigo)
    const d2 = map2.get(codigo)
    const saldo1 = d1?.saldo ?? 0
    const saldo2 = d2?.saldo ?? 0
    const variacionAbsoluta = saldo2 - saldo1
    const variacionRelativa = saldo1 !== 0 ? (variacionAbsoluta / saldo1) * 100.0 : 0.0
    const esBalance = bal1.has(codigo) || bal2.has(codigo)
    const tipoReporte = esBalance ? TIPO_REPORTE.BALANCE : TIPO_REPORTE.RESULTADOS
    const base1 = esBalance ? baseBal1 : baseRes1
    const base2 = esBalance ? baseBal2 : baseRes2
    horizontal.push({
      codigoCuenta: codigo,
      nombreCuenta: d2?.nombre ?? d1?.nombre ?? 'Cuenta no encontrada',
      saldoAnio1: saldo1,
      saldoAnio2: saldo2,
      variacionAbsoluta,
      variacionRelativa,
      porcentajeVerticalAnio1: base1 !== 0 ? (saldo1 / base1) * 100.0 : 0.0,
      porcentajeVerticalAnio2: base2 !== 0 ? (saldo2 / base2) * 100.0 : 0.0,
      tipoReporte,
    })
  }

  // ---- Vertical: Balance over Total Activo, Resultados over Ventas Netas ----
  const vertical = [
    ...buildVertical(bal1, bal2, baseBal1, baseBal2, TIPO_REPORTE.BALANCE),
    ...buildVertical(res1, res2, baseRes1, baseRes2, TIPO_REPORTE.RESULTADOS),
  ]

  return {
    empresaId,
    anio1,
    anio2,
    analisisHorizontal: horizontal,
    analisisVertical: vertical,
  }
}

const round2 = (v: number) => Math.round(v * 100.0) / 100.0

/**
 * Computes one ratio from the two separated maps (Módulo B, tarea B4).
 * Every figure comes from accountCodes.ts prefixes — the same source used
 * by ratios.ts — so evolution and ratio endpoints always agree.
 * `bal` = BALANCE_GENERAL lines, `res` = ESTADO_RESULTADOS lines (may be
 * empty when no Estado de Resultados has been loaded yet).
 * Returns null when the ratio is NOT MEANINGFUL (N/M) — e.g. ROE with
 * negative equity, where a loss divided by negative equity would wrongly
 * show a positive percentage.
 */
function computeRatio(
  key: string,
  bal: Map<string, LineaData>,
  res: Map<string, LineaData>,
): number | null {
  const A = (codes: string | string[]) => sumByPrefix(bal, codes)
  const R = (codes: string | string[]) => sumByPrefix(res, codes)
  // Utilidad Neta: from the ER (ingresos − costos/gastos) when available,
  // otherwise fall back to the balance line 3204 (resultado del ejercicio).
  const utilidadNeta = res.size > 0 ? R(TOTAL_INGRESOS) - R(TOTAL_COSTOS_GASTOS) : A(RESULTADO_EJERCICIO)

  switch (key) {
    case 'LIQUIDEZ_CORRIENTE':
      return A(PASIVO_CORRIENTE) !== 0 ? round2(A(ACTIVO_CORRIENTE) / A(PASIVO_CORRIENTE)) : 0.0
    case 'PRUEBA_ACIDA':
      return A(PASIVO_CORRIENTE) !== 0
        ? round2((A(ACTIVO_CORRIENTE) - A(INVENTARIOS)) / A(PASIVO_CORRIENTE))
        : 0.0
    case 'ROE': {
      const patrimonio = A(PATRIMONIO_TOTAL)
      // Patrimonio ≤ 0 → ROE no significativo (N/M): pérdida ÷ patrimonio
      // negativo daría un falso positivo.
      return patrimonio > 0 ? round2((utilidadNeta / patrimonio) * 100) : null
    }
    case 'ROA':
      return A(ACTIVO_TOTAL) !== 0 ? round2((utilidadNeta / A(ACTIVO_TOTAL)) * 100) : 0.0
    case 'ENDEUDAMIENTO':
      return A(ACTIVO_TOTAL) !== 0
        ? round2((A(PASIVO_TOTAL) / A(ACTIVO_TOTAL)) * 100)
        : 0.0
    default:
      return 0.0
  }
}

/**
 * HU-004: evolution of the requested ratios across the years that the
 * empresa has financial statements for (the Java version hardcoded the
 * years; here they come from the data). Output is a Recharts-ready array:
 * [{ anio: '2024', LIQUIDEZ_CORRIENTE: 1.75, ... }]
 */
export async function calcularEvolucionRatios(
  empresaId: number,
  ratios: string[],
): Promise<Map<string, unknown>[]> {
  // distinct years with data, ascending
  const { data: aniosData, error } = await supabaseAdmin
    .from('estado_financiero')
    .select('anio')
    .eq('empresa_id', empresaId)
  if (error) throw error
  const anios = [...new Set((aniosData ?? []).map((r) => r.anio as number))].sort(
    (a, b) => a - b,
  )

  const resultado: Map<string, unknown>[] = []
  for (const anio of anios) {
    const [bal, res] = await Promise.all([
      getSaldoMap(empresaId, anio, TIPO_REPORTE.BALANCE),
      getSaldoMap(empresaId, anio, TIPO_REPORTE.RESULTADOS),
    ])
    const entry: Map<string, unknown> = new Map()
    entry.set('anio', String(anio))
    for (const ratio of ratios) {
      entry.set(ratio, computeRatio(ratio, bal, res))
    }
    resultado.push(entry)
  }
  return resultado
}
