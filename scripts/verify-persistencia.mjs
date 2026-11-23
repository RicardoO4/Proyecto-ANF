// Supabase integration with isolated fixtures; NEVER calls Gemini.
// Removes only rows created by this run, even on failure.
import nextEnv from '@next/env'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
nextEnv.loadEnvConfig(process.cwd())
const originalFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href)
  assert.ok(!url.hostname.endsWith('googleapis.com'), 'Gemini prohibido en esta prueba')
  return originalFetch(input, init)
}
const { supabaseAdmin } = await import('../src/lib/supabase/admin.ts')
const { getEmpresaPrincipal } = await import('../src/lib/empresaPrincipal.ts')
const { conCachePersistente } = await import('../src/lib/cacheIA.ts')
const { prepararSerieVentas } = await import('../src/lib/pronosticos.ts')
const marker = 'persistencia-' + randomUUID()
const claves = [1, 2].map(i => createHash('sha256').update(`${marker}-${i}`).digest('hex'))
const { empresaId } = await getEmpresaPrincipal()
let reservado = false, anualId
const check = resultado => { assert.equal(resultado.error, null, resultado.error?.message); return resultado.data }
const mensual = (mes, monto = 100) => ({ fechaVenta: `2096-${String(mes).padStart(2, '0')}-01`, montoVenta: monto, observacion: marker })
try {
  const libres = check(await supabaseAdmin.from('venta').select('id_venta').eq('empresa_id', empresaId).gte('fecha_venta', '2096-01-01').lt('fecha_venta', '2097-01-01'))
  assert.equal(libres.length, 0, 'El año reservado ya tiene ventas; no se toca ese año')
  reservado = true
  let generaciones = 0
  const generar = async () => {
    generaciones++
    await new Promise(resolve => setTimeout(resolve, 100))
    return { interpretacion: { estadoGeneral: 'atencion', resumen: 'Respuesta ficticia de integración, sin Gemini', explicacionPorArea: [], puntosFuertes: [], alertas: [], recomendaciones: [], glosario: [] }, meta: { modelo: 'test-sin-gemini', generadoEn: new Date().toISOString(), tokens: { entrada: 0, salida: 0, total: 0 } } }
  }
  const simultaneas = await Promise.all([conCachePersistente(claves[0], 'test-sin-gemini', false, generar), conCachePersistente(claves[0], 'test-sin-gemini', false, generar)])
  assert.equal(generaciones, 1)
  assert.equal(simultaneas.filter(r => r.meta.desdeCache).length, 1)
  const reutilizada = await conCachePersistente(claves[0], 'test-sin-gemini', false, () => { throw Error('No debe generar') })
  assert.equal(reutilizada.meta.desdeCache, true)
  assert.equal((await conCachePersistente(claves[0], 'test-sin-gemini', true, generar)).meta.desdeCache, true)
  console.log('PASS 010: reserva entre dos solicitudes, persistencia y protección de regeneración, sin Gemini')
  await conCachePersistente(claves[1], 'test-sin-gemini', false, generar)
  assert.equal(generaciones, 2)
  console.log('PASS 010: contextos diferentes no reutilizan una respuesta equivocada')
  const anual = check(await supabaseAdmin.from('venta').insert({ empresa_id: empresaId, fecha_venta: '2096-12-31', monto_venta: 1000, observacion: 'Generado desde estados financieros 2096 ' + marker }).select('id_venta').single())
  anualId = anual.id_venta
  const insertar = ventas => supabaseAdmin.rpc('guardar_ventas_mensuales', { p_empresa_id: empresaId, p_ventas: ventas, p_id: null })
  const diciembre = await Promise.all([insertar([mensual(12)]), insertar([mensual(12)])])
  assert.equal(diciembre.filter(r => !r.error).length, 1)
  assert.equal(diciembre.filter(r => r.error?.code === 'ANF02').length, 1)
  assert.equal((await insertar([mensual(1), mensual(12)])).error?.code, 'ANF02')
  const trasFallo = check(await supabaseAdmin.from('venta').select('*').eq('empresa_id', empresaId).eq('observacion', marker))
  assert.equal(trasFallo.length, 1, 'El lote con conflicto debe revertirse completo')
  check(await supabaseAdmin.rpc('guardar_ventas_mensuales', { p_empresa_id: empresaId, p_ventas: [mensual(2)], p_id: trasFallo[0].id_venta }))
  check(await insertar(Array.from({ length: 12 }, (_, i) => i + 1).filter(m => m !== 2).map(m => mensual(m))))
  const ventas = check(await supabaseAdmin.from('venta').select('*').eq('empresa_id', empresaId).gte('fecha_venta', '2096-01-01').lt('fecha_venta', '2097-01-01'))
  assert.equal(ventas.length, 13)
  assert.equal(prepararSerieVentas(ventas, 'mensual').length, 12)
  const anuales = prepararSerieVentas([...ventas, { fecha_venta: '2094-12-31', monto_venta: 800, observacion: 'Generado desde estados financieros 2094' }, { fecha_venta: '2095-12-31', monto_venta: 900, observacion: 'Generado desde estados financieros 2095' }], 'anual')
  assert.equal(anuales.length, 3)
  assert.equal(anuales.at(-1).monto, 1000, 'El total anual no debe sumar otra vez su detalle mensual')
  console.log('PASS 011: diciembre junto al total anual, concurrencia, rollback de lote y edición sin duplicar')
} finally {
  for (const clave of claves) check(await supabaseAdmin.from('ia_cache').delete().eq('clave', clave))
  if (reservado) check(await supabaseAdmin.from('venta').delete().eq('empresa_id', empresaId).eq('observacion', marker))
  if (anualId) check(await supabaseAdmin.from('venta').delete().eq('id_venta', anualId))
  console.log('Fixtures de caché y ventas eliminados; Gemini no fue llamado')
  globalThis.fetch = originalFetch
}
