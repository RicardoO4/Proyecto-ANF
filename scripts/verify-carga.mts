// ================================================================
// Verificación de la carga de estados (Módulo A) sin BD ni servidor:
// ejecuta los parsers sobre las balanzas del equipo (scripts/fixtures),
// los Excel de ejemplo y libros armados en memoria con errores conocidos.
//
// Uso:  npm run verify:carga
// ================================================================
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import type { ValidationException } from '../src/lib/errors.ts'
import {
  esBalanzaComprobacion,
  esCargaUnificada,
  parseBalanzaComprobacion,
  parseCargaUnificada,
  parseEstadoFinanciero,
  readWorkbook,
  resumirCarga,
} from '../src/lib/excel.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
let fallos = 0
let total = 0

function check(nombre: string, ok: boolean, detalle = '') {
  total++
  if (!ok) fallos++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nombre}${detalle ? `  (${detalle})` : ''}`)
}

function libro(hojas: Record<string, unknown[][]>): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const [nombre, filas] of Object.entries(hojas)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), nombre)
  }
  // round-trip so cells look like a real uploaded file (with .w text)
  return XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array', cellDates: true })
}

function errores(wb: XLSX.WorkBook): string[] {
  try {
    parseCargaUnificada(wb)
    return []
  } catch (err) {
    // tsx carga errors.ts por ruta relativa y por alias '@/': instanceof no sirve aquí
    const e = err as Partial<ValidationException> & Error
    return e.detalles?.length ? e.detalles : [e.message]
  }
}

const META = [['campo', 'valor'], ['anio', 2020]]
const BAL_OK = [['Codigo', 'Saldo'], ['1101.01', 500], ['1201', 500], ['2101', 600], ['3101', 400]]
const RES_OK = [['Codigo', 'Saldo'], ['5101.01', 1000], ['4101', 600]]

function leer(ruta: string): XLSX.WorkBook {
  const buf = readFileSync(resolve(ROOT, ruta))
  return readWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer)
}

const centavos = (n: number) => Math.round(n * 100) / 100

// 1) balanzas de comprobación del equipo (scripts/fixtures, empresa 2)
const balanzas: Record<number, { activo: number; pasivo: number; utilidad: number; ventas: number }> = {
  2023: { activo: 5960622.79, pasivo: 6068364.28, utilidad: -144605.03, ventas: 1548023.87 },
  2024: { activo: 5713020.77, pasivo: 5915633.01, utilidad: -94870.75, ventas: 1636059.68 },
  2025: { activo: 6096672.29, pasivo: 6275785.64, utilidad: 23498.89, ventas: 1749164.35 },
}
for (const [anio, exp] of Object.entries(balanzas)) {
  const wb = leer(`scripts/fixtures/Plantilla_Balance_Comprobacion_${anio}_Empresa_2.xlsx`)
  check(`balanza ${anio}: detectada como BALANCE_COMPROBACION`, esBalanzaComprobacion(wb) && !esCargaUnificada(wb))
  const p = parseBalanzaComprobacion(wb)
  const r = resumirCarga(p.balance, p.resultados)
  check(`balanza ${anio}: empresa y año`, p.empresaId === 2 && p.anio === Number(anio), `${p.empresaId}/${p.anio}`)
  check(`balanza ${anio}: códigos de 3 niveles intactos`, p.balance.some((l) => l.codigoCuenta === '1101.01.01'))
  check(`balanza ${anio}: total activo (contracuentas restan)`, centavos(r.totalActivo) === exp.activo, String(r.totalActivo))
  check(`balanza ${anio}: pasivo en positivo`, centavos(r.totalPasivo) === exp.pasivo, String(r.totalPasivo))
  check(`balanza ${anio}: utilidad neta`, centavos(r.utilidadNeta) === exp.utilidad, String(r.utilidadNeta))
  check(`balanza ${anio}: ventas netas`, centavos(r.ventasNetas) === exp.ventas, String(r.ventasNetas))
  check(
    `balanza ${anio}: resultado en 3204 y balance cuadrado`,
    p.balance.find((l) => l.codigoCuenta === '3204')?.saldo === exp.utilidad &&
      Math.abs(r.totalActivo - r.totalPasivo - r.totalPatrimonio) < 0.05,
  )
}

// 2) ejemplos generados por scripts/generar-plantillas.mjs (mismo formato)
const esperados: Record<number, { activo: number; utilidad: number; ventas: number }> = {
  2020: { activo: 800000, utilidad: 100000, ventas: 980000 },
  2021: { activo: 880000, utilidad: 100000, ventas: 1125000 },
}
for (const [anio, exp] of Object.entries(esperados)) {
  const wb = leer(`public/templates/ejemplo_estados_${anio}.xlsx`)
  check(`ejemplo ${anio}: formato balanza detectado`, esBalanzaComprobacion(wb))
  const p = parseBalanzaComprobacion(wb)
  const r = resumirCarga(p.balance, p.resultados)
  check(`ejemplo ${anio}: año`, p.anio === Number(anio), String(p.anio))
  check(`ejemplo ${anio}: códigos con punto intactos`, p.balance.some((l) => l.codigoCuenta === '1101.01'))
  check(`ejemplo ${anio}: total activo`, r.totalActivo === exp.activo, String(r.totalActivo))
  check(`ejemplo ${anio}: utilidad neta (rebajas restadas)`, r.utilidadNeta === exp.utilidad, String(r.utilidadNeta))
  check(`ejemplo ${anio}: ventas netas para la tabla venta`, r.ventasNetas === exp.ventas, String(r.ventasNetas))
  check(
    `ejemplo ${anio}: solo el aviso del cierre`,
    p.avisos.length === 1 && p.avisos[0].includes('previa al cierre'),
    p.avisos.join(' | '),
  )
}

// 3) balanza con errores
{
  const META_BC = [['Campo', 'Valor'], ['Id Empresa', 2], ['Año del Reporte', 2020], ['Tipo de Reporte', 'BALANCE_COMPROBACION']]
  const err = (lineas: unknown[][]) => {
    try {
      parseBalanzaComprobacion(libro({ metadata: META_BC, lineas: [['Codigo', 'Saldo'], ...lineas] }))
      return []
    } catch (e) {
      const v = e as Partial<ValidationException> & Error
      return v.detalles?.length ? v.detalles : [v.message]
    }
  }
  check('balanza que no suma cero', err([['1101.01', 500], ['3101', '(400.00)'], ['5101.01', -200], ['4101', 50]]).some((e) => e.includes('La balanza no cuadra')))
  check('balanza sin cuentas de resultados', err([['1101.01', 500], ['3101', -500]]).some((e) => e.includes('Estado de Resultados')))
  check('balanza con grupo inválido', err([['1101.01', 500], ['3101', -500], ['6101', 0], ['5101.01', -10], ['4101', 10]]).some((e) => e.includes('no pertenece')))
}

// 4) formato original de un solo estado (metadata clave/valor, como el E2E de C)
{
  const wb = libro({
    metadata: [['campo', 'valor'], [], ['empresaId', 2], ['anio', 2022], ['tipoReporte', 'BALANCE_GENERAL']],
    lineas: [['cuenta', 'saldo'], ['1101.01', 100], ['2101', '1,000.50']],
  })
  const p = parseEstadoFinanciero(wb)
  check('formato original: no se confunde con balanza', !esBalanzaComprobacion(wb) && !esCargaUnificada(wb))
  check('formato original: metadata por clave', p.empresaId === 2 && p.anio === 2022 && p.tipoReporte === 'BALANCE_GENERAL')
  check('formato original: saldo en texto', p.lineas.find((l) => l.codigoCuenta === '2101')?.saldo === 1000.5)
}

// 5) carga unificada (metadata + balance + resultados): casos de error
check('libro válido mínimo pasa', errores(libro({ metadata: META, balance: BAL_OK, resultados: RES_OK })).length === 0)

check(
  'falta hoja resultados',
  errores(libro({ metadata: META, balance: BAL_OK })).some((e) => e.includes("'resultados' es obligatoria")),
)

check(
  'cuenta de resultados en la hoja balance (A2)',
  errores(libro({ metadata: META, balance: [...BAL_OK, ['5101.01', 10]], resultados: RES_OK })).some((e) =>
    e.includes("va en la hoja 'resultados'"),
  ),
)

check(
  'grupo inválido (6)',
  errores(libro({ metadata: META, balance: [...BAL_OK, ['6101', 10]], resultados: RES_OK })).some((e) =>
    e.includes('no pertenece'),
  ),
)

check(
  'balance que no cuadra',
  errores(
    libro({ metadata: META, balance: [['Codigo', 'Saldo'], ['1201', 999], ['2101', 600], ['3101', 400]], resultados: RES_OK }),
  ).some((e) => e.includes('no cuadra')),
)

check(
  'sin año en metadata',
  errores(libro({ metadata: [['campo', 'valor']], balance: BAL_OK, resultados: RES_OK })).some((e) => e.includes('anio')),
)

check(
  'saldo no numérico',
  errores(libro({ metadata: META, balance: [...BAL_OK, ['1102', 'abc']], resultados: RES_OK })).some((e) =>
    e.includes('saldo numérico'),
  ),
)

check(
  'subtotal que no coincide con subcuentas',
  errores(
    libro({
      metadata: META,
      balance: [['Codigo', 'Saldo'], ['1101', 900], ['1101.01', 500], ['1201', 400], ['2101', 600], ['3101', 400]],
      resultados: RES_OK,
    }),
  ).some((e) => e.includes('es subtotal')),
)

// 6) normalizaciones
{
  const p = parseCargaUnificada(
    libro({
      metadata: [['Año', 2020]],
      balance: [
        ['Cuenta', 'Descripción', 'Saldo Final'],
        ['1101', 'Efectivo', 500],
        ['1101.01', 'Caja', 200],
        ['1101.02', 'Bancos', 300],
        ['1201', 'PPE', '1,500.00'],
        ['1201', 'PPE (2)', 0],
        ['', 'TOTAL ACTIVO', 2000],
        ['2101', 'Préstamos', 1200],
        ['3101', 'Capital', 800],
      ],
      resultados: RES_OK,
    }),
  )
  check('encabezados alternativos y "Año" con tilde', p.anio === 2020)
  check('subtotal 1101 omitido al cuadrar con subcuentas', !p.balance.some((l) => l.codigoCuenta === '1101'))
  check('códigos repetidos se suman', p.balance.find((l) => l.codigoCuenta === '1201')?.saldo === 1500)
  check('monto en texto "1,500.00"', resumirCarga(p.balance, p.resultados).totalActivo === 2000)
  check('fila de total sin código ignorada', p.balance.length === 5)
  check(
    'avisos de subtotal, repetidos y cuentas de referencia faltantes',
    p.avisos.some((a) => a.includes('se omitió el subtotal 1101')) &&
      p.avisos.some((a) => a.includes('se sumaron sus saldos')) &&
      p.avisos.some((a) => a.includes('Faltan cuentas de referencia')),
    p.avisos.join(' | '),
  )
}

console.log(`\n${fallos === 0 ? 'OK' : 'FALLÓ'}: ${total - fallos}/${total} comprobaciones`)
process.exit(fallos === 0 ? 0 : 1)
