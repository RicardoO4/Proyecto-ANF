// Excel parsing for uploads — faithful port of the Apache POI logic.
//
// Estado financiero template layout (sheet 'metadata'): key/value rows
// (empresaId / anio / tipoReporte); without keys, the original fixed cells
// B3 -> empresaId, B4 -> anio, B5 -> tipoReporte.
// Sheet 'lineas': row 1 = header; col A = cuenta code (string or numeric),
// col B = saldo. The unified template (metadata + balance + resultados) and
// the trial balance (tipo BALANCE_COMPROBACION) are parsed further below.
//
// Ventas template layout (sheet 'metadata'): B2 -> empresaId (numeric)
// (POI read row 1 zero-based = Excel row 2). Sheet 'ventas': row 1 = header;
// col A = fecha (date), col B = monto, col C = observación.
import * as XLSX from 'xlsx'
import { BadRequestException, ValidationException } from '@/lib/errors'
import {
  ACTIVO_TOTAL,
  CUENTAS_ER_REQUERIDAS,
  PASIVO_TOTAL,
  PATRIMONIO_TOTAL,
  REBAJAS_DEVOLUCIONES,
  RESULTADO_EJERCICIO,
  TIPO_REPORTE,
  TOTAL_COSTOS_GASTOS,
  INGRESOS_NETOS,
  VENTAS_NETAS,
  clasificarCuenta,
  sumByPrefix,
} from '@/lib/accountCodes'

export interface UploadedEstadoFinanciero {
  empresaId: number
  anio: number
  tipoReporte: string
  lineas: { codigoCuenta: string; saldo: number }[]
}

export interface UploadedVentas {
  empresaId: number
  ventas: { fechaVenta: Date; montoVenta: number; observacion: string | null }[]
}

function getWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  try {
    return XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true })
  } catch (err) {
    throw new BadRequestException(
      'El archivo debe ser un Excel válido (.xlsx).',
    )
  }
}

function requireSheet(wb: XLSX.WorkBook, name: string): XLSX.WorkSheet {
  const sheet = wb.Sheets[name]
  if (!sheet) {
    throw new BadRequestException(`La hoja '${name}' es obligatoria.`)
  }
  return sheet
}

function cell(wbSheet: XLSX.WorkSheet, address: string): XLSX.CellObject | undefined {
  return wbSheet[address] as XLSX.CellObject | undefined
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/**
 * Account code as text. Numeric cells use the displayed text (`w`) so a
 * custom format keeps '1101.10'; a General-formatted number has already
 * lost trailing zeros, which the catalog lookup then reports.
 */
function readCodigo(c: XLSX.CellObject | undefined): string | null {
  if (!c) return null
  if (typeof c.v === 'string') return c.v.trim() || null
  if (typeof c.v === 'number' && Number.isFinite(c.v)) {
    return (c.w ?? String(c.v)).replace(/\s+/g, '').trim() || null
  }
  return null
}

export function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return getWorkbook(buffer)
}

/** Parses the single-statement workbook (metadata B3/B4/B5 + 'lineas'). */
export function parseEstadoFinanciero(input: ArrayBuffer | XLSX.WorkBook): UploadedEstadoFinanciero {
  const wb = 'SheetNames' in input ? input : getWorkbook(input)

  const metadata = requireSheet(wb, 'metadata')
  // key/value rows ('Id Empresa', 'Año del Reporte', ...) win over the fixed cells
  const meta = leerMetadata(wb)

  const empresaIdRaw = meta.empresaId ?? asNumber(cell(metadata, 'B3')?.v)
  if (empresaIdRaw === null) {
    throw new BadRequestException(
      "El 'empresaId' no se encontró o tiene un formato incorrecto en la celda B3 de la hoja 'metadata'.",
    )
  }
  const anioRaw = meta.anio ?? asNumber(cell(metadata, 'B4')?.v)
  if (anioRaw === null) {
    throw new BadRequestException(
      "El 'anio' no se encontró o tiene un formato incorrecto en la celda B4 de la hoja 'metadata'.",
    )
  }
  const tipoRaw = meta.tipoReporte ?? cell(metadata, 'B5')?.v
  const tipoReporte =
    typeof tipoRaw === 'string' && tipoRaw.trim() !== ''
      ? tipoRaw.trim()
      : typeof tipoRaw === 'number'
        ? String(tipoRaw)
        : null
  if (!tipoReporte) {
    throw new BadRequestException(
      "El 'tipoReporte' no se encontró o tiene un formato incorrecto en la celda B5 de la hoja 'metadata'.",
    )
  }

  const lineasSheet = requireSheet(wb, 'lineas')
  const rows: { codigoCuenta: string; saldo: number }[] = []
  const range = XLSX.utils.decode_range(lineasSheet['!ref'] ?? 'A1')
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    // skip the header row (r == range.s.r)
    const codeCell = lineasSheet[XLSX.utils.encode_cell({ r, c: 0 })]
    const saldoCell = lineasSheet[XLSX.utils.encode_cell({ r, c: 1 })]

    // col A: the code exactly as Excel shows it; anything else skipped
    const codigo = readCodigo(codeCell)
    if (!codigo) continue

    const saldo = readMonto(saldoCell)
    if (saldo === null) continue // col B must be an amount

    rows.push({ codigoCuenta: codigo, saldo })
  }

  if (rows.length === 0) {
    throw new BadRequestException("La hoja 'lineas' no contiene datos válidos.")
  }

  return { empresaId: Math.trunc(empresaIdRaw), anio: Math.trunc(anioRaw), tipoReporte, lineas: rows }
}

/** Parses the ventas workbook exactly like ProyeccionService. */
export function parseVentas(buffer: ArrayBuffer): UploadedVentas {
  const wb = getWorkbook(buffer)
  const metadata = requireSheet(wb, 'metadata')

  const empresaIdRaw = asNumber(cell(metadata, 'B2')?.v)
  if (empresaIdRaw === null) {
    throw new BadRequestException(
      "El 'empresaId' no se encontró o tiene un formato incorrecto en la celda B2 de la hoja 'metadata'.",
    )
  }

  const ventasSheet = requireSheet(wb, 'ventas')
  const ventas: UploadedVentas['ventas'] = []
  const range = XLSX.utils.decode_range(ventasSheet['!ref'] ?? 'A1')
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const fechaCell = ventasSheet[XLSX.utils.encode_cell({ r, c: 0 })]
    const montoCell = ventasSheet[XLSX.utils.encode_cell({ r, c: 1 })]
    const obsCell = ventasSheet[XLSX.utils.encode_cell({ r, c: 2 })]

    // col A must be a date
    let fecha: Date | null = null
    if (fechaCell?.v instanceof Date) {
      fecha = fechaCell.v
    } else if (typeof fechaCell?.v === 'string' && fechaCell.v.trim() !== '') {
      const parsed = new Date(fechaCell.v)
      if (!Number.isNaN(parsed.getTime())) fecha = parsed
    }
    if (!fecha) continue

    const monto =
      typeof montoCell?.v === 'number' && Number.isFinite(montoCell.v)
        ? (montoCell.v as number)
        : null
    if (monto === null) continue // non-numeric rows are skipped silently

    const observacion =
      typeof obsCell?.v === 'string' && (obsCell.v as string).trim() !== ''
        ? (obsCell.v as string).trim()
        : null

    ventas.push({ fechaVenta: fecha, montoVenta: monto, observacion })
  }

  if (ventas.length === 0) {
    throw new BadRequestException(
      "La hoja 'ventas' no contiene datos válidos o está vacía.",
    )
  }

  return { empresaId: Math.trunc(empresaIdRaw), ventas }
}

// ================================================================
// Carga unificada (Módulo A, A1-A3): un solo .xlsx con las hojas
//   metadata   -> filas clave/valor: 'anio' (obligatorio), 'empresaId' (opcional)
//   balance    -> Codigo | Nombre (opcional) | Saldo   (grupos 1, 2, 3)
//   resultados -> Codigo | Nombre (opcional) | Saldo   (grupos 4, 5)
// Las columnas se detectan por el encabezado de la fila 1; sin
// encabezados reconocibles se usa A = código, B = saldo.
// ================================================================

export interface LineaCarga {
  codigoCuenta: string
  nombre: string | null
  saldo: number
}

export interface UploadedCargaUnificada {
  empresaId: number | null
  anio: number
  balance: LineaCarga[]
  resultados: LineaCarga[]
  avisos: string[]
}

const HOJA_BALANCE = 'balance'
const HOJA_RESULTADOS = 'resultados'
const TOLERANCIA = 0.05
const MAX_DETALLES = 50

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function findSheet(wb: XLSX.WorkBook, name: string): XLSX.WorkSheet | undefined {
  const key = wb.SheetNames.find((n) => normalizar(n) === normalizar(name))
  return key ? wb.Sheets[key] : undefined
}

/** True when the workbook follows the unified template (balance + resultados). */
export function esCargaUnificada(wb: XLSX.WorkBook): boolean {
  return Boolean(findSheet(wb, HOJA_BALANCE) || findSheet(wb, HOJA_RESULTADOS))
}

function cellText(c: XLSX.CellObject | undefined): string {
  if (!c || c.v === undefined || c.v === null) return ''
  return String(c.w ?? c.v).trim()
}

/** Amount from a numeric cell or from text like "1,234.50", "$ 300" or "(45.00)". */
function readMonto(c: XLSX.CellObject | undefined): number | null {
  if (!c) return null
  if (typeof c.v === 'number') return Number.isFinite(c.v) ? c.v : null
  if (typeof c.v !== 'string') return null
  let s = c.v.trim().replace(/[\s$]/g, '')
  if (s === '') return null
  let negativo = false
  if (/^\(.*\)$/.test(s)) {
    negativo = true
    s = s.slice(1, -1)
  }
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '')
  else if (/^-?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '')
  else s = s.replace(',', '.')
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

const ENCABEZADOS = {
  codigo: ['codigo', 'cod', 'codigocuenta', 'nocuenta', 'numerocuenta', 'cuenta'],
  nombre: ['nombre', 'nombrecuenta', 'descripcion', 'concepto', 'detalle', 'cuenta'],
  saldo: ['saldo', 'saldofinal', 'monto', 'valor', 'importe', 'total'],
} as const

type Columnas = { codigo: number; nombre: number | null; saldo: number }

function detectarColumnas(sheet: XLSX.WorkSheet, range: XLSX.Range, hoja: string): Columnas {
  const headers = new Map<number, string>()
  for (let c = range.s.c; c <= range.e.c; c++) {
    const text = normalizar(cellText(sheet[XLSX.utils.encode_cell({ r: range.s.r, c })]))
    if (text) headers.set(c, text)
  }
  const usadas = new Set<number>()
  // exact header first, then a prefix ('Codigo de la Cuenta Contable(sin espacios)')
  const buscar = (opciones: readonly string[]): number | null => {
    for (const coincide of [
      (text: string, opcion: string) => text === opcion,
      (text: string, opcion: string) => opcion.length >= 5 && text.startsWith(opcion),
    ]) {
      for (const opcion of opciones) {
        for (const [col, text] of headers) {
          if (!usadas.has(col) && coincide(text, opcion)) {
            usadas.add(col)
            return col
          }
        }
      }
    }
    return null
  }
  const codigo = buscar(ENCABEZADOS.codigo)
  const saldo = buscar(ENCABEZADOS.saldo)
  const nombre = buscar(ENCABEZADOS.nombre)

  if (codigo === null && saldo === null) {
    return { codigo: range.s.c, nombre: null, saldo: range.s.c + 1 }
  }
  if (codigo === null || saldo === null) {
    throw new ValidationException(
      `La hoja '${hoja}' debe tener las columnas 'Codigo' y 'Saldo' en la primera fila.`,
    )
  }
  return { codigo, nombre, saldo }
}

interface Metadata {
  anio: number | null
  empresaId: number | null
  tipoReporte: string | null
}

const CLAVES_ANIO = ['anio', 'ano', 'year', 'ejercicio', 'aniodelreporte', 'anodelreporte']
const CLAVES_EMPRESA = ['empresaid', 'idempresa', 'empresa']
const CLAVES_TIPO = ['tiporeporte', 'tipodereporte', 'tipo']

/** Key/value rows of 'metadata' (column A = key, column B = value). */
function leerMetadata(wb: XLSX.WorkBook): Metadata {
  const sheet = findSheet(wb, 'metadata')
  if (!sheet) throw new BadRequestException("La hoja 'metadata' es obligatoria.")
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  let anio: number | null = null
  let empresaId: number | null = null
  let tipoReporte: string | null = null
  for (let r = range.s.r; r <= range.e.r; r++) {
    const clave = normalizar(cellText(sheet[XLSX.utils.encode_cell({ r, c: 0 })]))
    const celda = sheet[XLSX.utils.encode_cell({ r, c: 1 })]
    if (CLAVES_ANIO.includes(clave)) anio = asNumber(celda?.v)
    if (CLAVES_EMPRESA.includes(clave)) empresaId = asNumber(celda?.v)
    if (CLAVES_TIPO.includes(clave)) tipoReporte = cellText(celda) || null
  }
  return {
    anio: anio === null ? null : Math.trunc(anio),
    empresaId: empresaId === null ? null : Math.trunc(empresaId),
    tipoReporte,
  }
}

function leerHojaEstado(
  wb: XLSX.WorkBook,
  hoja: typeof HOJA_BALANCE | typeof HOJA_RESULTADOS,
  errores: string[],
  avisos: string[],
): LineaCarga[] {
  const sheet = findSheet(wb, hoja)
  if (!sheet) {
    errores.push(`La hoja '${hoja}' es obligatoria.`)
    return []
  }
  const esperado = hoja === HOJA_BALANCE ? TIPO_REPORTE.BALANCE : TIPO_REPORTE.RESULTADOS
  const filas = leerFilas(sheet, hoja, errores).filter((f) => {
    if (f.tipo === esperado) return true
    const destino = f.tipo === TIPO_REPORTE.BALANCE ? HOJA_BALANCE : HOJA_RESULTADOS
    errores.push(`Hoja '${hoja}', fila ${f.fila}: la cuenta ${f.codigoCuenta} va en la hoja '${destino}'.`)
    return false
  })
  return consolidar(hoja, filas, errores, avisos)
}

interface FilaLeida extends LineaCarga {
  fila: number
  tipo: string
}

/** Rows with a code and an amount; rows without a code (titles) are skipped. */
function leerFilas(sheet: XLSX.WorkSheet, hoja: string, errores: string[]): FilaLeida[] {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  const cols = detectarColumnas(sheet, range, hoja)
  const filas: FilaLeida[] = []
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const fila = r + 1
    const codigo = readCodigo(sheet[XLSX.utils.encode_cell({ r, c: cols.codigo })])
    if (!codigo) continue

    const saldo = readMonto(sheet[XLSX.utils.encode_cell({ r, c: cols.saldo })])
    if (saldo === null) {
      errores.push(`Hoja '${hoja}', fila ${fila}: la cuenta ${codigo} no tiene un saldo numérico.`)
      continue
    }
    const tipo = clasificarCuenta(codigo)
    if (tipo === null) {
      errores.push(
        `Hoja '${hoja}', fila ${fila}: la cuenta ${codigo} no pertenece al Balance General (1, 2, 3) ni al Estado de Resultados (4, 5).`,
      )
      continue
    }
    const nombre =
      cols.nombre !== null ? cellText(sheet[XLSX.utils.encode_cell({ r, c: cols.nombre })]) || null : null
    filas.push({ codigoCuenta: codigo, nombre, saldo, fila, tipo })
  }
  return filas
}

/** Sums repeated codes and drops parent subtotals loaded next to their sub-accounts. */
function consolidar(
  hoja: string,
  filas: FilaLeida[],
  errores: string[],
  avisos: string[],
): LineaCarga[] {
  const porCodigo = new Map<string, LineaCarga & { filas: number[] }>()
  for (const { codigoCuenta, nombre, saldo, fila } of filas) {
    const previa = porCodigo.get(codigoCuenta)
    if (previa) {
      previa.saldo += saldo
      previa.filas.push(fila)
    } else {
      porCodigo.set(codigoCuenta, { codigoCuenta, nombre, saldo, filas: [fila] })
    }
  }

  for (const linea of porCodigo.values()) {
    if (linea.filas.length > 1) {
      avisos.push(
        `Hoja '${hoja}': la cuenta ${linea.codigoCuenta} aparece en las filas ${linea.filas.join(', ')}; se sumaron sus saldos.`,
      )
    }
  }

  // Un solo nivel por rama: el motor suma por prefijo, así que un subtotal
  // junto con sus subcuentas contaría doble.
  const codigos = [...porCodigo.keys()]
  const hijos = (padre: string) => codigos.filter((c) => c !== padre && c.startsWith(padre))
  const padres = codigos.filter((c) => hijos(c).length > 0)
  for (const padre of padres) {
    const hojas = hijos(padre).filter((c) => hijos(c).length === 0)
    const sumaHojas = hojas.reduce((s, c) => s + porCodigo.get(c)!.saldo, 0)
    const saldoPadre = porCodigo.get(padre)!.saldo
    if (Math.abs(saldoPadre - sumaHojas) <= TOLERANCIA) {
      avisos.push(
        `Hoja '${hoja}': se omitió el subtotal ${padre} porque ya vienen sus subcuentas (${hojas.join(', ')}).`,
      )
    } else {
      errores.push(
        `Hoja '${hoja}': la cuenta ${padre} (${saldoPadre.toFixed(2)}) es subtotal de ${hojas.join(', ')}, pero estas suman ${sumaHojas.toFixed(2)}. Cargue solo un nivel.`,
      )
    }
  }
  for (const padre of padres) porCodigo.delete(padre)

  if (porCodigo.size === 0 && !errores.some((e) => e.startsWith(`Hoja '${hoja}'`))) {
    errores.push(`La hoja '${hoja}' no contiene cuentas con saldo.`)
  }
  return [...porCodigo.values()].map(({ codigoCuenta, nombre, saldo }) => ({
    codigoCuenta,
    nombre,
    saldo: Math.round(saldo * 100) / 100,
  }))
}

export interface ResumenCuadre {
  totalActivo: number
  totalPasivo: number
  totalPatrimonio: number
  totalIngresos: number
  totalCostosGastos: number
  utilidadNeta: number
  ventasNetas: number
}

function toMap(lineas: LineaCarga[]): Map<string, { saldo: number }> {
  return new Map(lineas.map((l) => [l.codigoCuenta, { saldo: l.saldo }]))
}

/** Totals grouped with the accountCodes.ts prefixes. */
export function resumirCarga(balance: LineaCarga[], resultados: LineaCarga[]): ResumenCuadre {
  const bal = toMap(balance)
  const res = toMap(resultados)
  // Rebajas y devoluciones (5101.02) vienen en positivo pero restan del
  // ingreso: sacarlas de la suma del grupo 5 y restarlas una vez.
  const totalIngresos = sumByPrefix(res, INGRESOS_NETOS)
  const totalCostosGastos = sumByPrefix(res, TOTAL_COSTOS_GASTOS)
  return {
    totalActivo: sumByPrefix(bal, ACTIVO_TOTAL),
    totalPasivo: sumByPrefix(bal, PASIVO_TOTAL),
    totalPatrimonio: sumByPrefix(bal, PATRIMONIO_TOTAL),
    totalIngresos,
    totalCostosGastos,
    utilidadNeta: totalIngresos - totalCostosGastos,
    ventasNetas: sumByPrefix(res, VENTAS_NETAS),
  }
}

function validarCuadre(
  balance: LineaCarga[],
  resultados: LineaCarga[],
  errores: string[],
  avisos: string[],
): void {
  const r = resumirCarga(balance, resultados)
  const pasivoMasPatrimonio = r.totalPasivo + r.totalPatrimonio
  const cuadra = Math.abs(r.totalActivo - pasivoMasPatrimonio) <= TOLERANCIA
  const cuadraConUtilidad =
    Math.abs(r.totalActivo - (pasivoMasPatrimonio + r.utilidadNeta)) <= TOLERANCIA
  if (!cuadra && cuadraConUtilidad) {
    avisos.push(
      `El balance cuadra solo al sumar la utilidad del ejercicio (${r.utilidadNeta.toFixed(2)}); conviene registrarla en la cuenta ${RESULTADO_EJERCICIO}.`,
    )
  } else if (!cuadra) {
    errores.push(
      `El balance no cuadra: Activo ${r.totalActivo.toFixed(2)} ≠ Pasivo + Patrimonio ${pasivoMasPatrimonio.toFixed(2)} (diferencia ${(r.totalActivo - pasivoMasPatrimonio).toFixed(2)}).`,
    )
  }

  const resultadoBalance = balance.filter((l) => l.codigoCuenta.startsWith(RESULTADO_EJERCICIO))
  if (resultadoBalance.length > 0) {
    const saldo3204 = resultadoBalance.reduce((s, l) => s + l.saldo, 0)
    if (Math.abs(saldo3204 - r.utilidadNeta) > TOLERANCIA) {
      avisos.push(
        `La utilidad del Estado de Resultados (${r.utilidadNeta.toFixed(2)}) no coincide con la cuenta ${RESULTADO_EJERCICIO} del balance (${saldo3204.toFixed(2)}).`,
      )
    }
  }

  const faltantes = CUENTAS_ER_REQUERIDAS.filter(
    (prefijo) => !resultados.some((l) => l.codigoCuenta.startsWith(prefijo)),
  )
  if (faltantes.length > 0) {
    avisos.push(
      `Faltan cuentas de referencia del Estado de Resultados: ${faltantes.join(', ')}. Los ratios que las usan quedarán en cero.`,
    )
  }
  if (resultados.some((l) => l.codigoCuenta.startsWith(REBAJAS_DEVOLUCIONES) && l.saldo < 0)) {
    avisos.push(
      `Las rebajas y devoluciones (${REBAJAS_DEVOLUCIONES}) vienen negativas; el sistema ya las resta de las ventas, así que deberían ir en positivo.`,
    )
  }
}

/**
 * Parses and validates the unified workbook. Every problem is collected and
 * thrown together as a ValidationException (with `detalles`), so the user
 * can fix the file in one pass. The catalog lookup happens in the route.
 */
export function parseCargaUnificada(wb: XLSX.WorkBook): UploadedCargaUnificada {
  const errores: string[] = []
  const avisos: string[] = []

  const { anio, empresaId } = leerMetadata(wb)
  if (anio === null || anio < 1900 || anio > 2100) {
    errores.push("La hoja 'metadata' debe tener una fila 'anio' con un año válido en la columna B.")
  }

  const balance = leerHojaEstado(wb, HOJA_BALANCE, errores, avisos)
  const resultados = leerHojaEstado(wb, HOJA_RESULTADOS, errores, avisos)
  if (balance.length > 0 && resultados.length > 0) {
    validarCuadre(balance, resultados, errores, avisos)
  }

  if (errores.length > 0) {
    throw new ValidationException(
      `El archivo tiene ${errores.length} error(es). Corríjalos y vuelva a cargarlo.`,
      errores.slice(0, MAX_DETALLES),
    )
  }
  return { empresaId, anio: anio as number, balance, resultados, avisos }
}

// ================================================================
// Balanza de comprobación (formato de importación del equipo):
//   metadata -> 'Id Empresa', 'Año del Reporte', 'Tipo de Reporte' = BALANCE_COMPROBACION
//   lineas   -> Codigo | Saldo, saldo deudor (+) y acreedor (−, o entre paréntesis)
// Se convierte a BALANCE_GENERAL + ESTADO_RESULTADOS (contrato de B): las
// cuentas de naturaleza acreedora (2, 3, 5) cambian de signo y el resultado
// del ejercicio, si la balanza es previa al cierre, se lleva a la 3204.
// ================================================================

const HOJA_LINEAS = 'lineas'
const TIPOS_BALANZA = [
  'balancecomprobacion',
  'balancedecomprobacion',
  'balanzacomprobacion',
  'balanzadecomprobacion',
]

/** True when the workbook is a trial balance ('lineas' + tipo BALANCE_COMPROBACION). */
export function esBalanzaComprobacion(wb: XLSX.WorkBook): boolean {
  if (!findSheet(wb, HOJA_LINEAS) || !findSheet(wb, 'metadata')) return false
  const { tipoReporte } = leerMetadata(wb)
  return tipoReporte !== null && TIPOS_BALANZA.includes(normalizar(tipoReporte))
}

/** Debit-signed trial balance amount → amount as shown in BG/ER. */
function saldoEnEstado(codigo: string, saldo: number): number {
  // rebajas y devoluciones son deudoras y el motor ya las resta de las ventas
  if (codigo.startsWith(REBAJAS_DEVOLUCIONES)) return saldo
  return ['2', '3', '5'].includes(codigo[0]) ? -saldo : saldo
}

export function parseBalanzaComprobacion(wb: XLSX.WorkBook): UploadedCargaUnificada {
  const errores: string[] = []
  const avisos: string[] = []

  const { anio, empresaId } = leerMetadata(wb)
  if (anio === null || anio < 1900 || anio > 2100) {
    errores.push("La hoja 'metadata' debe tener la fila 'Año del Reporte' con un año válido en la columna B.")
  }

  const filas = leerFilas(findSheet(wb, HOJA_LINEAS)!, HOJA_LINEAS, errores)
  const diferencia = filas.reduce((s, f) => s + f.saldo, 0)
  if (filas.length > 0 && Math.abs(diferencia) > TOLERANCIA) {
    errores.push(
      `La balanza no cuadra: los saldos deudores y acreedores difieren en ${diferencia.toFixed(2)}. Los saldos acreedores deben ir en negativo o entre paréntesis.`,
    )
  }

  const convertidas = filas.map((f) => ({ ...f, saldo: saldoEnEstado(f.codigoCuenta, f.saldo) }))
  const delBalance = convertidas.filter((f) => f.tipo === TIPO_REPORTE.BALANCE)
  const deResultados = convertidas.filter((f) => f.tipo === TIPO_REPORTE.RESULTADOS)
  if (delBalance.length === 0) {
    errores.push('La balanza no trae cuentas del Balance General (grupos 1, 2 y 3).')
  }
  if (deResultados.length === 0) {
    errores.push('La balanza no trae cuentas del Estado de Resultados (grupos 4 y 5).')
  }
  const balance = delBalance.length > 0 ? consolidar(HOJA_LINEAS, delBalance, errores, avisos) : []
  const resultados = deResultados.length > 0 ? consolidar(HOJA_LINEAS, deResultados, errores, avisos) : []

  if (balance.length > 0 && resultados.length > 0) {
    const tieneResultado = balance.some((l) => l.codigoCuenta.startsWith(RESULTADO_EJERCICIO))
    const { utilidadNeta } = resumirCarga(balance, resultados)
    if (!tieneResultado && Math.abs(utilidadNeta) >= 0.01) {
      const saldo = Math.round(utilidadNeta * 100) / 100
      balance.push({ codigoCuenta: RESULTADO_EJERCICIO, nombre: 'Resultado del ejercicio', saldo })
      avisos.push(
        `La balanza es previa al cierre: se registró el ${saldo >= 0 ? 'resultado' : 'déficit'} del ejercicio (${saldo.toFixed(2)}) en la cuenta ${RESULTADO_EJERCICIO} del Balance General.`,
      )
    }
    validarCuadre(balance, resultados, errores, avisos)
  }

  if (errores.length > 0) {
    throw new ValidationException(
      `El archivo tiene ${errores.length} error(es). Corríjalos y vuelva a cargarlo.`,
      errores.slice(0, MAX_DETALLES),
    )
  }
  return { empresaId, anio: anio as number, balance, resultados, avisos }
}

/**
 * Uploads the raw file for record-keeping into the excel-uploads bucket.
 * Best-effort: a storage failure never blocks the import itself.
 */
export async function archiveUpload(
  file: File,
  folder: string,
): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/admin')
    const safeName = file.name.replace(/[^\w.\-]+/g, '_')
    const path = `${folder}/${Date.now()}-${safeName}`
    const buffer = await file.arrayBuffer()
    const { error } = await supabaseAdmin.storage
      .from('excel-uploads')
      .upload(path, new Uint8Array(buffer), {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      })
    if (error) {
      console.error('[storage] archiveUpload failed:', error.message)
      return null
    }
    return path
  } catch (err) {
    console.error('[storage] archiveUpload failed:', err)
    return null
  }
}
