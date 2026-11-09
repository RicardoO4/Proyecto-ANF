// ================================================================
// E2E de AU1 — recálculo automático tras una carga de estados financieros.
//
// Simula una carga real contra el servidor en marcha:
//   1. crea 4 filas de `ratio` para la empresa 2, año 2022 (sin valor);
//   2. arma un BALANCE_GENERAL mínimo y lo sube por
//      POST /api/v1/estados-financieros/upload;
//   3. comprueba que el hook AU1 calculó los 4 ratios sin intervención;
//   4. borra TODO lo que creó (estado financiero + líneas + ratios).
//
// El año 2022 se elige a propósito: no tiene datos reales, así que no
// pisa el histórico de Inv ABC. Si el proceso se interrumpe, volver a
// correrlo limpia los restos antes de empezar.
//
// Uso:  node scripts/e2e-au1.mjs   (con `npm run dev` en el puerto 3000)
// ================================================================
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EMPRESA_ID = 2
const ANIO = 2022
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

function loadEnv() {
  const env = {}
  for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  return { base: `${url.replace(/\/$/, '')}/rest/v1`, key }
}

const { base, key } = loadEnv()
const HEADERS = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

async function rest(method, path, body) {
  const res = await fetch(`${base}/${path}`, {
    method,
    headers: { ...HEADERS, Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

// Balance sintético (códigos folia, igual que una carga real):
//   Activo corriente 920 = 1101.01 500 + 1102 300 + 1105 120
//   Activo total    1120 = 920 + 1201 200
//   Pasivo total     720 = 2101 500 + 2201 220
//   Patrimonio       400 = 3101 400      → 1120 = 720 + 400 ✔
// Esperado: ácida 1.60 / endeudamiento 0.64 / propiedad 0.36 / patrimonial 1.80
const LINEAS = [
  ['1101.01', 500],
  ['1102', 300],
  ['1105', 120],
  ['1201', 200],
  ['2101', 500],
  ['2201', 220],
  ['3101', 400],
]

const ESPERADOS = {
  'Prueba ácida': 1.6,
  'Grado de endeudamiento': 0.64,
  'Grado de propiedad': 0.36,
  'Razón de endeudamiento patrimonial': 1.8,
}

function buildWorkbook() {
  const wb = XLSX.utils.book_new()
  // El parser lee B3, B4 y B5: la fila 2 va vacía a propósito.
  const metadata = XLSX.utils.aoa_to_sheet([
    ['campo', 'valor'],
    [],
    ['empresaId', EMPRESA_ID],
    ['anio', ANIO],
    ['tipoReporte', 'BALANCE_GENERAL'],
  ])
  const lineas = XLSX.utils.aoa_to_sheet([['cuenta', 'saldo'], ...LINEAS])
  XLSX.utils.book_append_sheet(wb, metadata, 'metadata')
  XLSX.utils.book_append_sheet(wb, lineas, 'lineas')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

async function limpiar() {
  // ratios creados por este script para (empresa 2, 2022)
  const ratios = await rest('GET', `ratio?select=id_ratio&empresa_id=eq.${EMPRESA_ID}&anio_ratio=eq.${ANIO}`)
  if (ratios?.length) {
    await rest('DELETE', `ratio?id_ratio=in.(${ratios.map((r) => r.id_ratio).join(',')})`)
  }
  // estados financieros de 2022 (borra en cascada las líneas)
  const efs = await rest('GET', `estado_financiero?select=id_estado_financiero&empresa_id=eq.${EMPRESA_ID}&anio=eq.${ANIO}`)
  if (efs?.length) {
    await rest('DELETE', `estado_financiero?id_estado_financiero=in.(${efs.map((e) => e.id_estado_financiero).join(',')})`)
  }
  return { ratios: ratios?.length ?? 0, efs: efs?.length ?? 0 }
}

async function main() {
  console.log(`E2E AU1 — empresa ${EMPRESA_ID}, año ${ANIO}, servidor ${BASE_URL}`)
  const previo = await limpiar()
  if (previo.ratios || previo.efs) {
    console.log(`  (limpieza previa: ${previo.ratios} ratios, ${previo.efs} estados financieros)`)
  }

  const categorias = await rest('GET', 'categoria_ratio?select=id_categoria_ratio,nombre_tipo')
  const parametros = await rest(
    'GET',
    'parametro_sector?select=id_parametro_sector,nombre_ratio,anio_referencia&id_sector=eq.' +
      (await rest('GET', `empresa?select=id_sector&empresa_id=eq.${EMPRESA_ID}`))[0].id_sector,
  )
  const filas = Object.keys(ESPERADOS).map((nombre) => {
    const categoria = categorias.find((c) => c.nombre_tipo === nombre)
    if (!categoria) throw new Error(`No existe la categoría "${nombre}" — correr npm run seed:ratios`)
    // `calculateRatio` exige un benchmark asociado; se reutiliza el de 2023
    // para no dejar parámetros de prueba en la BD.
    const parametro = parametros.find((p) => p.nombre_ratio === nombre)
    if (!parametro) throw new Error(`No existe benchmark para "${nombre}" — correr npm run seed:ratios`)
    return {
      anio_ratio: ANIO,
      periodo_ratio: 'ANUAL',
      empresa_id: EMPRESA_ID,
      id_categoria_ratio: categoria.id_categoria_ratio,
      id_parametro_sector: parametro.id_parametro_sector,
    }
  })
  const creados = await rest('POST', 'ratio', filas)
  console.log(`  ratios creados sin valor: ${creados.length}`)

  const form = new FormData()
  form.append(
    'file',
    new Blob([buildWorkbook()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    'e2e-au1.xlsx',
  )
  const res = await fetch(`${BASE_URL}/api/v1/estados-financieros/upload`, {
    method: 'POST',
    body: form,
  })
  console.log(`  POST /estados-financieros/upload → ${res.status}`)
  if (res.status !== 201) throw new Error(`Se esperaba 201, llegó ${res.status}: ${await res.text()}`)

  const resultado = await rest(
    'GET',
    `ratio?select=id_ratio,valor_calculado,cumple_sector,categoria_ratio!inner(nombre_tipo)&empresa_id=eq.${EMPRESA_ID}&anio_ratio=eq.${ANIO}`,
  )

  let fallos = 0
  for (const [nombre, esperado] of Object.entries(ESPERADOS)) {
    const fila = resultado.find((r) => r.categoria_ratio?.nombre_tipo === nombre)
    if (!fila) {
      console.log(`FAIL  ${nombre.padEnd(38)} no quedó fila de ratio`)
      fallos++
      continue
    }
    // La columna sigue en NUMERIC(15,2) hasta correr el ALTER de 003.
    const ok = fila.valor_calculado !== null && Math.abs(Number(fila.valor_calculado) - esperado) <= 0.005
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  ${nombre.padEnd(38)} valor=${String(fila.valor_calculado).padEnd(6)} (esperado ${esperado})`,
    )
    if (!ok) fallos++
  }

  const limpieza = await limpiar()
  console.log(`  limpieza: ${limpieza.ratios} ratios, ${limpieza.efs} estados financieros eliminados`)
  console.log(`\n${fallos === 0 ? 'OK' : 'FALLÓ'}: ${Object.keys(ESPERADOS).length - fallos}/${Object.keys(ESPERADOS).length} comprobaciones`)
  process.exit(fallos === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('ERROR:', err.message)
  try {
    await limpiar()
  } catch {
    /* la limpieza es best-effort */
  }
  process.exit(1)
})
