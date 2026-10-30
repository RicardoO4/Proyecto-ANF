// Analysis logic — faithful port of AnalisisService.
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { LineaAnalisisDTO, ReporteInternoDTO } from '@/types'

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
    codigo_individual: string | null
    codigo_generado: string | null
  } | null
}

/**
 * Builds the map `[codigo -> {saldo, nombre}]` for an empresa+anio,
 * using the same key/fallback chain as the Java service:
 * code = cuenta.codigoGenerado ?? cuenta.codigoIndividual ?? linea.id,
 * name = cuenta.nombreCuenta ?? "Cuenta " + code; duplicates keep the FIRST.
 */
async function getSaldoMap(empresaId: number, anio: number): Promise<Map<string, LineaData>> {
  const { data, error } = await supabaseAdmin
    .from('linea_estado_financiero')
    .select(
      'id_linea, saldo, estado_financiero!inner(empresa_id, anio), cuenta!inner(cue_cuenta_id, codigo_individual, codigo_generado, nombre_cuenta)',
    )
    .eq('estado_financiero.empresa_id', empresaId)
    .eq('estado_financiero.anio', anio)
  if (error) throw error

  const map = new Map<string, LineaData>()
  for (const raw of (data ?? []) as unknown as LineaEstadoRow[]) {
    const cuenta = raw.cuenta
    let codigo: string
    if (cuenta?.codigo_generado && cuenta.codigo_generado.trim() !== '') {
      codigo = cuenta.codigo_generado
    } else if (cuenta?.cue_cuenta_id && cuenta.cue_cuenta_id.trim() !== '') {
      codigo = cuenta.cue_cuenta_id
    } else {
      codigo = raw.id_linea.toString()
    }
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

/**
 * HU-001: reporte interno (análisis horizontal + vertical).
 * Parity note (kept intentionally): the Java service returns the SAME
 * computed array for both analisisHorizontal and analisisVertical, and the
 * ratios section is a hardcoded mock. Reproduced exactly.
 */
export async function generarReporteInterno(
  empresaId: number,
  anio1: number,
  anio2: number,
): Promise<ReporteInternoDTO> {
  const [map1, map2] = await Promise.all([
    getSaldoMap(empresaId, anio1),
    getSaldoMap(empresaId, anio2),
  ])

  if (map1.size === 0 || map2.size === 0) {
    return { empresaId, anio1, anio2, analisisHorizontal: [], analisisVertical: [], ratios: [] }
  }

  const total1 = [...map1.values()].reduce((s, d) => s + d.saldo, 0)
  const total2 = [...map2.values()].reduce((s, d) => s + d.saldo, 0)

  const union = new Set<string>([...map1.keys(), ...map2.keys()])
  const lineas: LineaAnalisisDTO[] = []
  for (const codigo of union) {
    const d1 = map1.get(codigo)
    const d2 = map2.get(codigo)
    const saldo1 = d1?.saldo ?? 0
    const saldo2 = d2?.saldo ?? 0
    const variacionAbsoluta = saldo2 - saldo1
    const variacionRelativa = saldo1 !== 0 ? (variacionAbsoluta / saldo1) * 100.0 : 0.0
    const porcentajeV1 = total1 !== 0 ? (saldo1 / total1) * 100.0 : 0.0
    const porcentajeV2 = total2 !== 0 ? (saldo2 / total2) * 100.0 : 0.0
    lineas.push({
      codigoCuenta: codigo,
      nombreCuenta: d2?.nombre ?? d1?.nombre ?? 'Cuenta no encontrada',
      saldoAnio1: saldo1,
      saldoAnio2: saldo2,
      variacionAbsoluta,
      variacionRelativa,
      porcentajeVerticalAnio1: porcentajeV1,
      porcentajeVerticalAnio2: porcentajeV2,
    })
  }

  return {
    empresaId,
    anio1,
    anio2,
    analisisHorizontal: lineas,
    analisisVertical: lineas,
    ratios: [
      { nombre: 'Liquidez Corriente', valorAnio1: 1.5, valorAnio2: 1.7 },
      { nombre: 'Endeudamiento', valorAnio1: 0.6, valorAnio2: 0.55 },
    ],
  }
}

// Account codes used by the evolution endpoint (as in the Java service)
const CODIGO_ACTIVO_CORRIENTE = '11'
const CODIGO_PASIVO_CORRIENTE = '21'
const CODIGO_VENTAS = '197'
const CODIGO_TOTAL_ACTIVO = '1'
const CODIGO_TOTAL_PATRIMONIO = '138'
const CODIGO_UTILIDAD_NETA = '141'
const CODIGO_INVENTARIOS = '1406' // the Java code reused '11' (bug); 1406 is the real inventory account
const CODIGO_PASIVO_TOTAL = '85'

const round2 = (v: number) => Math.round(v * 100.0) / 100.0

function computeRatio(key: string, d: Map<string, LineaData>): number {
  const saldo = (code: string) => d.get(code)?.saldo ?? 0
  const activoCorriente = saldo(CODIGO_ACTIVO_CORRIENTE)
  const pasivoCorriente = saldo(CODIGO_PASIVO_CORRIENTE)
  const ventas = saldo(CODIGO_VENTAS)
  const totalActivo = saldo(CODIGO_TOTAL_ACTIVO)
  const totalPatrimonio = saldo(CODIGO_TOTAL_PATRIMONIO)
  const utilidadNeta = saldo(CODIGO_UTILIDAD_NETA)
  const inventarios = saldo(CODIGO_INVENTARIOS)

  switch (key) {
    case 'LIQUIDEZ_CORRIENTE':
      return pasivoCorriente !== 0 ? round2(activoCorriente / pasivoCorriente) : 0.0
    case 'PRUEBA_ACIDA':
      return pasivoCorriente !== 0
        ? round2((activoCorriente - inventarios) / pasivoCorriente)
        : 0.0
    case 'ROE':
      return totalPatrimonio !== 0 ? round2((utilidadNeta / totalPatrimonio) * 100) : 0.0
    case 'ROA':
      return totalActivo !== 0 ? round2((utilidadNeta / totalActivo) * 100) : 0.0
    case 'ENDEUDAMIENTO':
      return totalActivo !== 0
        ? round2((saldo(CODIGO_PASIVO_TOTAL) / totalActivo) * 100)
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
    const map = await getSaldoMap(empresaId, anio)
    const entry: Map<string, unknown> = new Map()
    entry.set('anio', String(anio))
    for (const ratio of ratios) {
      entry.set(ratio, computeRatio(ratio, map))
    }
    resultado.push(entry)
  }
  return resultado
}
