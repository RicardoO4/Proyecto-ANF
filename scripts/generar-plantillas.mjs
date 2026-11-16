// ================================================================
// Genera los Excel de carga en formato Balance de Comprobación (Módulo A, A1 y A5):
//   public/templates/plantilla_estado_financiero.xlsx  (plantilla vacía)
//   public/templates/ejemplo_estados_2020.xlsx         (ejemplo, año 2020)
//   public/templates/ejemplo_estados_2021.xlsx         (ejemplo, año 2021)
//
// Los ejemplos usan 2020/2021 a propósito: no tienen datos reales de
// Inv ABC (2023-2025) ni chocan con el E2E de AU1 (2022). Las cuentas
// existen en el catálogo tras el seed 006. Cada balanza suma cero y es
// previa al cierre: al cargarla, la utilidad (100000) va a la 3204.
//
// Uso:  node scripts/generar-plantillas.mjs
// ================================================================
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public/templates')

const EJEMPLOS = {
  2020: {
    balance: {
      '1101.01': 15000, '1101.02': 85000, '1102': 120000, '1105': 180000, '1201': 400000,
      '2101': 150000, '2102': 130000, '2201': 200000,
      '3101': 220000, '3204': 100000,
    },
    resultados: {
      '5101.01': 1000000, '5101.02': 20000,
      '4101': 600000, '4102': 150000, '4103': 100000, '4201': 30000,
    },
  },
  2021: {
    balance: {
      '1101.01': 18000, '1101.02': 102000, '1102': 135000, '1105': 195000, '1201': 430000,
      '2101': 160000, '2102': 140000, '2201': 180000,
      '3101': 300000, '3204': 100000,
    },
    resultados: {
      '5101.01': 1150000, '5101.02': 25000,
      '4101': 690000, '4102': 165000, '4103': 120000, '4201': 50000,
    },
  },
}

const EMPRESA_ID = 2

/** BG/ER amount → trial balance amount: debit (+), credit (−). */
function saldoBalanza(codigo, saldo) {
  if (codigo.startsWith('5101.02')) return saldo
  return ['2', '3', '5'].includes(codigo[0]) ? -saldo : saldo
}

/**
 * Same layout as the team's import files (Balance de Comprobación): code
 * cells as text so Excel never drops '.01'; credit balances in negative.
 */
function libro(anio, saldos) {
  const wb = XLSX.utils.book_new()
  const metadata = XLSX.utils.aoa_to_sheet([
    ['Campo', 'Valor'],
    ['Id Empresa', EMPRESA_ID],
    ['Año del Reporte', anio],
    ['Tipo de Reporte', 'BALANCE_COMPROBACION'],
  ])
  metadata['!cols'] = [{ wch: 18 }, { wch: 24 }]
  XLSX.utils.book_append_sheet(wb, metadata, 'metadata')

  const filas = [['Codigo de la Cuenta Contable(sin espacios)', 'Saldo']]
  for (const [codigo, saldo] of Object.entries(saldos)) filas.push([codigo, saldoBalanza(codigo, saldo)])
  const lineas = XLSX.utils.aoa_to_sheet(filas)
  for (let r = 1; r < filas.length; r++) {
    lineas[XLSX.utils.encode_cell({ r, c: 0 })] = { t: 's', v: String(filas[r][0]), z: '@' }
    const saldoRef = XLSX.utils.encode_cell({ r, c: 1 })
    if (lineas[saldoRef]) lineas[saldoRef].z = '#,##0.00;(#,##0.00)'
  }
  lineas['!cols'] = [{ wch: 42 }, { wch: 18 }]
  XLSX.utils.book_append_sheet(wb, lineas, 'lineas')
  return wb
}

function instrucciones() {
  return XLSX.utils.aoa_to_sheet([
    ['Plantilla de Balance de Comprobación — Sistema ANF'],
    [],
    ['metadata', "Filas 'Id Empresa', 'Año del Reporte' y 'Tipo de Reporte' (BALANCE_COMPROBACION), valores en la columna B."],
    ['lineas', 'Columna A: código de la cuenta (texto, sin espacios). Columna B: saldo al cierre del año.'],
    [],
    ['Reglas'],
    ['', 'Saldos deudores en positivo y acreedores en negativo o entre paréntesis: la balanza debe sumar cero.'],
    ['', 'Escriba los códigos como TEXTO, tal como están en el catálogo (ej. 1101.01.01).'],
    ['', 'Cargue un solo nivel por cuenta: la cuenta de mayor o sus subcuentas, no ambas.'],
    ['', 'Se generan el Balance General (cuentas 1, 2, 3) y el Estado de Resultados (cuentas 4, 5).'],
    ['', 'Si la balanza es previa al cierre, el resultado del ejercicio se registra en la cuenta 3204.'],
    ['', 'También se registra la venta anual (ventas netas 5101.01 − 5101.02).'],
    ['', 'Si el año ya existe, el sistema pide confirmación para reemplazarlo.'],
  ])
}

mkdirSync(OUT, { recursive: true })

const plantilla = libro(2025, { '1101.01': 0, '2101': 0, '3101': 0, '4101': 0, '5101.01': 0 })
XLSX.utils.book_append_sheet(plantilla, instrucciones(), 'instrucciones')
XLSX.writeFile(plantilla, resolve(OUT, 'plantilla_estado_financiero.xlsx'))
console.log('plantilla_estado_financiero.xlsx')

for (const [anio, datos] of Object.entries(EJEMPLOS)) {
  const nombre = `ejemplo_estados_${anio}.xlsx`
  // previa al cierre: sin 3204, el sistema la calcula desde los resultados
  const balance = Object.fromEntries(Object.entries(datos.balance).filter(([codigo]) => codigo !== '3204'))
  XLSX.writeFile(libro(Number(anio), { ...balance, ...datos.resultados }), resolve(OUT, nombre))
  console.log(nombre)
}
