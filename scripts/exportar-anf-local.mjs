// Exportación de solo lectura. No copia usuarios, sesiones ni secretos de IA.
import nextEnv from '@next/env'
import { mkdirSync, writeFileSync } from 'node:fs'
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
if (!url.hostname.endsWith('.supabase.co')) throw new Error('El origen debe ser el Supabase de ANF.')
const tables = {
  sector: 'id_sector', empresa: 'empresa_id', cuenta: 'cuenta_id', catalogo: 'id_catalogo',
  tipo_ratio: 'id_tipo_ratio', categoria_ratio: 'id_categoria_ratio', parametro_sector: 'id_parametro_sector',
  estado_financiero: 'id_estado_financiero', linea_estado_financiero: 'id_linea', ratio: 'id_ratio', venta: 'id_venta',
}
const snapshot = { fecha: new Date().toISOString(), tablas: {} }
for (const [table, key] of Object.entries(tables)) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const endpoint = new URL(`/rest/v1/${table}`, url)
    endpoint.search = new URLSearchParams({ select: '*', order: `${key}.asc`, offset: String(offset), limit: '1000' })
    const response = await fetch(endpoint, { method: 'GET', headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    } })
    if (!response.ok) throw new Error(`No se pudo leer ${table}: HTTP ${response.status}`)
    const page = await response.json()
    rows.push(...page)
    if (page.length < 1000) break
  }
  if (table === 'empresa') rows.forEach(row => { row.usuario_id = null })
  snapshot.tablas[table] = rows
  console.log(`${table}: ${rows.length} registros leídos`)
}
mkdirSync('.local-data', { recursive: true })
writeFileSync('.local-data/anf-snapshot.json', JSON.stringify(snapshot), { mode: 0o600 })
console.log('Copia privada guardada. El origen solo recibió peticiones GET.')
