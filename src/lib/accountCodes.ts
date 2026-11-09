// =================================================---------------
// Fuente única de códigos contables — Módulo B, tarea B1.
// Catálogo real: "CATALOGO MODELO CONTA ACTIVOS - FINAN II 2025".
//
// IMPORTANTE: cada valor es un PREFIJO, no un código exacto. Los datos
// subidos a linea_estado_financiero están agregados a nivel padre
// ('1101.01', '1102', '1105'...), así que se suman todas las líneas cuyo
// cue_cuenta_id empiece con el prefijo. Esto funciona igual si en el
// futuro los datos llegan a nivel hoja ('1101.01.01'...).
// Cargar un solo nivel sin solapamientos: nunca un subtotal padre junto
// con sus hijos, pues ambos saldos se sumarían. Cada código debe ser único
// dentro del estado (getSaldoMap conserva la primera fila repetida).
//
// Un prefijo que empiece con '-' se RESTA (ej. Ventas Netas).
//
// Ejemplo de validación (Inv ABC 2024): sumByPrefix('1') debe dar
// exactamente 5,632,723.49 = Total Activos.
// ================================================================
//
// ================================================================
// CONTRATO DE CARGA — para Integrante A (ingesta) y el resto del equipo
// ================================================================
//
// 1) tipo_reporte: SOLO existen estos dos valores, exactos:
//
//        'BALANCE_GENERAL'    'ESTADO_RESULTADOS'
//
//    Si la carga escribe otro string ('BALANCE', 'RESULTADOS',
//    'BALANCE_COMPROBACION'...), getSaldoMap()/sumSaldos() devuelven
//    0 o vacío SIN LANZAR ERROR: tablas en blanco, gráficas en cero y
//    ratios en 0, sin mensaje. Usar esTipoReporte() para validar.
//
// 2) Cuentas de referencia del ER: ver CUENTAS_ER_REQUERIDAS.
//    Sin líneas de ER, la sección vertical está vacía y ROE/ROA usan
//    el fallback 3204 del balance. Con cualquier línea de ER, la utilidad
//    se calcula como grupo 5 menos grupo 4, aunque la carga esté incompleta.
//    Ventas netas = 5101.01 - 5101.02; si la base es 0, el vertical da 0.
//    Para utilidad REAL cargar todos los ingresos y costos/gastos del
//    ejercicio (grupos 5 y 4), sin duplicar subtotales y detalles.
//
// 3) Los balances son POR AÑO (cierre anual), no mensuales: un registro
//    estado_financiero por (empresa, año, tipo_reporte). La BD tiene
//    UNIQUE(empresa_id, anio, tipo_reporte) → subir dos veces el mismo
//    año+tipo falla por duplicado (eso lo maneja A3).
//
// 4) Las cuentas deben EXISTIR en la tabla `cuenta` antes de subir:
//    la ruta de upload resuelve cue_cuenta_id → cuenta_id y truena si
//    el código no está en el catálogo. clasificarCuenta() solo orienta
//    por grupo; no verifica que un código exista ni convierte un BC.
//
// 5) VALORES DE ACEPTACIÓN (Inv ABC, verificados en BD) — sirven para
//    probar que una carga nueva quedó bien:
//
//    | Prueba                  | 2023        | 2024        | 2025        |
//    |-------------------------|-------------|-------------|-------------|
//    | Total Activo (prefijo 1)| 5297318.03  | 5632723.49  | 5951250.73  |
//    | Líneas de balance       | 21          | 21          | 21          |
//    | Caja vertical           | —           | 0.67%       | —           |
//    | Liquidez corriente      | 0.36        | 0.38        | 0.41        |
//
//    (ER: hoy Inv ABC NO tiene datos de resultados cargados.)
// ================================================================

// ------------------------- TIPO REPORTE -------------------------

/** Valores EXACTOS de estado_financiero.tipo_reporte (contrato de carga). */
export const TIPO_REPORTE = {
  BALANCE: 'BALANCE_GENERAL',
  RESULTADOS: 'ESTADO_RESULTADOS',
} as const

export type TipoReporte = (typeof TIPO_REPORTE)[keyof typeof TIPO_REPORTE]

/**
 * Guard de validación para la carga (tarea A2):
 *   if (!esTipoReporte(b5)) throw new BadRequestException(...)
 * Devuelve false para cualquier otro string (incluido un 3er tipo).
 */
export function esTipoReporte(v: unknown): v is TipoReporte {
  return v === TIPO_REPORTE.BALANCE || v === TIPO_REPORTE.RESULTADOS
}

// ------------------------- BALANCE -------------------------

/** Caja (1101.01) + Bancos (1101.02) */
export const EFECTIVO = '1101'
/** Todo activo que empiece con 11 */
export const ACTIVO_CORRIENTE = '11'
/** Cuentas y documentos por cobrar (el balance reporta el padre 1102) */
export const CUENTAS_POR_COBRAR = '1102'
export const INVENTARIOS = '1105'
/** Propiedades, Planta y Equipo (neto) */
export const ACTIVOS_FIJOS = '1201'
export const ACTIVO_NO_CORRIENTE = '12'
/** Derivado: suma de todo 1xxx = Total Activos */
export const ACTIVO_TOTAL = '1'
export const PASIVO_CORRIENTE = '21'
/** Cuentas comerciales por pagar */
export const CUENTAS_POR_PAGAR = '2102'
export const PASIVO_NO_CORRIENTE = '22'
/** Derivado: suma de todo 2xxx = Total Pasivos */
export const PASIVO_TOTAL = '2'
/** Derivado: suma de todo 3xxx = Total Patrimonio */
export const PATRIMONIO_TOTAL = '3'
/** "DÉFICIT DEL PRESENTE EJERCICIO": utilidad (+) o pérdida (−) del año.
 *  Se usa como fallback de Utilidad Neta mientras no haya Estado de Resultados. */
export const RESULTADO_EJERCICIO = '3204'

// ------------------ ESTADO DE RESULTADOS ------------------

/** Ventas locales sala de ventas */
export const VENTAS_BRUTAS = '5101.01'
/** Rebajas y devoluciones sobre ventas (se resta) */
export const REBAJAS_DEVOLUCIONES = '5101.02'
/** Derivado: 5101.01 − 5101.02 */
export const VENTAS_NETAS = [VENTAS_BRUTAS, `-${REBAJAS_DEVOLUCIONES}`]
export const COSTO_VENTAS = '4101'
export const GASTOS_ADMINISTRATIVOS = '4102'
export const GASTOS_VENTA = '4103'
/** Derivado: 4102 + 4103 */
export const GASTOS_OPERATIVOS = [GASTOS_ADMINISTRATIVOS, GASTOS_VENTA]
export const GASTOS_FINANCIEROS = '4201'
/** Derivado: suma de todo 5xxx (ingresos) */
export const TOTAL_INGRESOS = '5'
/** Derivado: suma de todo 4xxx (costos y gastos) */
export const TOTAL_COSTOS_GASTOS = '4'
/**
 * Cuentas de referencia para validar la cobertura de la hoja 'resultados'
 * (contrato B→A). Se admiten sus desgloses por prefijo sin cargar también
 * el padre. Una cuenta sin movimiento puede tener saldo 0; su ausencia
 * aporta 0 al cálculo, no demuestra que la carga esté completa.
 * No es un validador automático ni basta para obtener la utilidad real:
 * ROE/ROA usan todos los ingresos (5) menos todos los costos/gastos (4).
 * Solo sin líneas de ER se usa RESULTADO_EJERCICIO del balance.
 */
export const CUENTAS_ER_REQUERIDAS = [
  VENTAS_BRUTAS, // 5101.01
  REBAJAS_DEVOLUCIONES, // 5101.02 (se resta)
  COSTO_VENTAS, // 4101
  GASTOS_ADMINISTRATIVOS, // 4102
  GASTOS_VENTA, // 4103
  GASTOS_FINANCIEROS, // 4201
] as const

// ------------------------- Helper pure -------------------------

type Linea = { saldo: number }

/**
 * Suma los saldos de un mapa [codigo -> {saldo}] que empiecen con cada
 * prefijo. Un prefijo con '-' se resta. Función pura (sin BD).
 *
 * sumByPrefix(map, '11')            → Activo Corriente
 * sumByPrefix(map, VENTAS_NETAS)    → 5101.01 − 5101.02
 */
export function sumByPrefix(
  map: Map<string, Linea>,
  codes: string | string[],
): number {
  const arr = Array.isArray(codes) ? codes : [codes]
  let total = 0
  for (const entry of arr) {
    const resta = entry.startsWith('-')
    const prefijo = resta ? entry.slice(1) : entry
    for (const [code, d] of map) {
      if (code.startsWith(prefijo)) {
        total += resta ? -d.saldo : d.saldo
      }
    }
  }
  return total
}

/**
 * Clasifica una cuenta por su PREFIJO (contrato de carga, Módulo B):
 *   1xxx/2xxx/3xxx → BALANCE_GENERAL   (activo, pasivo, patrimonio)
 *   4xxx/5xxx      → ESTADO_RESULTADOS (costos/gastos, ingresos)
 *   otro (6, 7...) → null (no pertenece a ningún estado financiero)
 * Sirve a A para validar filas ("hay una cuenta 5xxx en la hoja balance")
 * o para partir un documento fuente en los dos estados.
 */
export function clasificarCuenta(codigo: string): TipoReporte | null {
  const c = codigo.trim()
  if (/^[123]/.test(c)) return TIPO_REPORTE.BALANCE
  if (/^[45]/.test(c)) return TIPO_REPORTE.RESULTADOS
  return null
}
