// ================================================================
// Aplica el seed de `supabase/migrations/003_seed_ratios.sql` vía
// PostgREST, sin depender del editor SQL de Supabase.
//
// Equivalente al SQL, con una excepción que PostgREST no puede hacer:
// el ALTER de precisión a NUMERIC(15,4). Si se necesita, correr sólo
// ese bloque a mano en el SQL editor.
//
// Idempotente: consulta lo existente y sólo inserta lo que falta.
// Uso:  node scripts/seed-ratios.mjs
// ================================================================
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EMPRESA_ID = 2

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
const HEADERS = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
}

async function get(path) {
  const res = await fetch(`${base}/${path}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

async function post(table, rows) {
  if (rows.length === 0) return []
  const res = await fetch(`${base}/${table}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`POST ${table} → ${res.status} ${await res.text()}`)
  return res.json()
}

const TIPOS = [
  { nombre_ratio: 'Apalancamiento', codigo_ratio: 'APAL', descripcion: 'Endeudamiento y estructura de capital', unidad_ratio: 'razon' },
  { nombre_ratio: 'Actividad', codigo_ratio: 'ACTI', descripcion: 'Eficiencia y rotación de cuentas', unidad_ratio: 'razon' },
]

const CATEGORIAS = [
  { nombre_tipo: 'Prueba ácida', descripcion: 'Liquidez inmediata sin inventario', tipo: 'Liquidez' },
  { nombre_tipo: 'Grado de endeudamiento', descripcion: 'Pasivo total sobre activo total', tipo: 'Apalancamiento' },
  { nombre_tipo: 'Grado de propiedad', descripcion: 'Patrimonio sobre activo total', tipo: 'Apalancamiento' },
  { nombre_tipo: 'Razón de endeudamiento patrimonial', descripcion: 'Pasivo total sobre patrimonio', tipo: 'Apalancamiento' },
]

const BENCHMARKS = [
  { categoria: 'Prueba ácida', ref: 1.0 },
  { categoria: 'Grado de endeudamiento', ref: 0.6 },
  { categoria: 'Grado de propiedad', ref: 0.4 },
  { categoria: 'Razón de endeudamiento patrimonial', ref: 1.5 },
]
const ANIOS = [2023, 2024, 2025]
const FUENTE = 'Referencia inicial Módulo C — pendiente de calibración sectorial'

async function main() {
  // 1) tipos
  const tipos = await get('tipo_ratio?select=*')
  const tiposNuevos = TIPOS.filter((t) => !tipos.some((x) => x.nombre_ratio === t.nombre_ratio))
  const tiposCreados = await post('tipo_ratio', tiposNuevos)
  console.log(`tipo_ratio: ${tiposCreados.length} creados, ${tipos.length} ya existían`)

  // 2) categorías
  const tiposAll = await get('tipo_ratio?select=*')
  const categorias = await get('categoria_ratio?select=*')
  const categoriasNuevas = CATEGORIAS.filter(
    (c) => !categorias.some((x) => x.nombre_tipo === c.nombre_tipo),
  ).map((c) => {
    const tipo = tiposAll.find((t) => t.nombre_ratio === c.tipo)
    if (!tipo) throw new Error(`No existe el tipo_ratio "${c.tipo}"`)
    return { nombre_tipo: c.nombre_tipo, descripcion: c.descripcion, id_tipo_ratio: tipo.id_tipo_ratio }
  })
  const categoriasCreadas = await post('categoria_ratio', categoriasNuevas)
  console.log(`categoria_ratio: ${categoriasCreadas.length} creadas, ${categorias.length} ya existían`)

  // 3) benchmarks
  const categoriasAll = await get('categoria_ratio?select=*')
  const empresa = (await get(`empresa?select=empresa_id,id_sector&empresa_id=eq.${EMPRESA_ID}`))[0]
  if (!empresa) throw new Error(`No existe la empresa ${EMPRESA_ID}`)
  const parametros = await get('parametro_sector?select=*')
  const parametrosNuevos = []
  for (const b of BENCHMARKS) {
    const categoria = categoriasAll.find((c) => c.nombre_tipo === b.categoria)
    if (!categoria) throw new Error(`No existe la categoría "${b.categoria}"`)
    for (const anio of ANIOS) {
      const existe = parametros.some(
        (p) =>
          p.nombre_ratio === b.categoria &&
          Number(p.anio_referencia) === anio &&
          p.id_sector === empresa.id_sector,
      )
      if (existe) continue
      parametrosNuevos.push({
        nombre_ratio: b.categoria,
        valor_referencia: b.ref,
        fuente: FUENTE,
        anio_referencia: anio,
        id_sector: empresa.id_sector,
        id_categoria_ratio: categoria.id_categoria_ratio,
      })
    }
  }
  const parametrosCreados = await post('parametro_sector', parametrosNuevos)
  console.log(`parametro_sector: ${parametrosCreados.length} creados, ${parametros.length} ya existían`)

  // 4) filas de ratio
  const parametrosAll = await get('parametro_sector?select=*')
  const ratios = await get(`ratio?select=*&empresa_id=eq.${EMPRESA_ID}`)
  const ratiosNuevos = []
  for (const p of parametrosAll) {
    if (!ANIOS.includes(Number(p.anio_referencia))) continue
    const categoria = categoriasAll.find((c) => c.id_categoria_ratio === p.id_categoria_ratio)
    if (!categoria || !CATEGORIAS.some((c) => c.nombre_tipo === categoria.nombre_tipo)) continue
    const existe = ratios.some(
      (r) =>
        r.anio_ratio === p.anio_referencia &&
        r.id_categoria_ratio === p.id_categoria_ratio,
    )
    if (existe) continue
    ratiosNuevos.push({
      anio_ratio: p.anio_referencia,
      periodo_ratio: 'ANUAL',
      empresa_id: EMPRESA_ID,
      id_categoria_ratio: p.id_categoria_ratio,
      id_parametro_sector: p.id_parametro_sector,
    })
  }
  const ratiosCreados = await post('ratio', ratiosNuevos)
  console.log(`ratio: ${ratiosCreados.length} creados, ${ratios.length} ya existían`)
  if (ratiosCreados.length) {
    console.log('IDs nuevos:', ratiosCreados.map((r) => r.id_ratio).join(', '))
  }
  console.log('Listo. Nota: el ALTER a NUMERIC(15,4) sólo se aplica desde el editor SQL.')
}

main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
