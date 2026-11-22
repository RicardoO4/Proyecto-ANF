// Offline batch recalculation regression tests. All HTTP is intercepted.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ratios-test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
const empresas = new Map(), firmas = new Map()
let llamadas = [], cambioConcurrente = false
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const { recalcularRatios, CATEGORIAS_CALCULABLES, VERSION_CALCULO_RATIOS } = await import('../src/lib/ratios.ts')
function preparar(id, anios = [2090]) {
  const empresa = { estados: [], lineas: [], ratios: [], categorias: CATEGORIAS_CALCULABLES.map(nombre_tipo => ({ nombre_tipo })), referencia: 0.1 }
  for (const anio of anios) {
    for (const tipo_reporte of ['BALANCE_GENERAL', 'ESTADO_RESULTADOS']) empresa.estados.push({ anio, tipo_reporte })
    for (const [codigo, saldo] of [['1101', 100], ['1103', 200], ['1105', 300], ['1201', 400], ['2102', 200], ['2201', 100], ['3101', 700], ['5101.01', 1000], ['4101', 500], ['4102', 100], ['4103', 50], ['4201', 10]]) empresa.lineas.push({ anio, tipo_reporte: /^[123]/.test(codigo) ? 'BALANCE_GENERAL' : 'ESTADO_RESULTADOS', codigo, saldo })
    CATEGORIAS_CALCULABLES.forEach((nombre_tipo, i) => empresa.ratios.push({ id_ratio: anio * 100 + i, anio_ratio: anio, empresa_id: id, periodo_ratio: 'ANUAL', categoriaRatio: { nombre_tipo }, parametroSector: { valor_referencia: 0.1 }, valor_calculado: null }))
  }
  empresas.set(id, empresa)
  return empresa
}
function snapshot(e, anio) {
  return { estados: e.estados.filter(l => l.anio === anio || l.anio === anio - 1), lineas: e.lineas.filter(l => l.anio === anio || l.anio === anio - 1), categorias: e.categorias, referencias: e.referencia,
    ratios: e.ratios.filter(r => r.anio_ratio === anio).map(r => ({ ...r, valor_calculado: undefined, valor_sector_promedio: undefined, diferencia_vs_sector: undefined, cumple_sector: undefined, interpretacion: null })) }
}
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href)
  assert.equal(url.hostname, 'ratios-test.invalid')
  const nombre = url.pathname.split('/').at(-1)
  llamadas.push(nombre)
  assert.ok(url.pathname.includes('/rpc/'), 'El lote no debe consultar cada saldo, ratio o relación por separado')
  const p = JSON.parse(init.body), e = empresas.get(p.p_empresa_id), clave = `${p.p_empresa_id}/${p.p_anio}`
  const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json' } })
  if (nombre === 'asegurar_ratios_anio') return json(0)
  const datos = snapshot(e, p.p_anio), huella = hash(datos)
  const salida = () => hash(e.ratios.filter(r => r.anio_ratio === p.p_anio))
  if (nombre === 'consultar_recalculo_ratios') {
    const f = firmas.get(clave)
    return json({ datos, huella, vigente: Boolean(f && f.version === p.p_version && f.huella === huella && f.salida === salida()) })
  }
  assert.equal(nombre, 'guardar_recalculo_ratios')
  if (cambioConcurrente || p.p_huella !== huella) return json({ code: 'ANF03', message: 'Los datos cambiaron durante el cálculo' }, 409)
  firmas.delete(clave)
  p.p_filas.forEach(f => Object.assign(e.ratios.find(r => r.id_ratio === f.id_ratio), f))
  if (p.p_completo) firmas.set(clave, { huella, version: p.p_version, salida: salida() })
  return new Response(null, { status: 204 })
}
test('ratios: primer cálculo en cuatro RPC; segundo solo verifica y no escribe', async () => {
  preparar(1); llamadas = []
  const a = await recalcularRatios(1, 2090)
  assert.equal(a.calculados, 23); assert.deepEqual(a.fallos, [])
  const liquidez = empresas.get(1).ratios.find(r => r.categoriaRatio.nombre_tipo === 'Razón de circulante o liquidez corriente')
  assert.equal(liquidez.valor_calculado, 3)
  assert.match(liquidez.interpretacion, /3\.00 USD de activo corriente por cada dólar/)
  assert.doesNotMatch(liquidez.interpretacion, /600\.00 USD/)
  assert.equal(llamadas.length, 4)
  llamadas = []
  const b = await recalcularRatios(1, 2090)
  assert.equal(b.omitidos, 23); assert.equal(b.actualizado, true)
  assert.deepEqual(llamadas, ['consultar_recalculo_ratios'])
})
test('ratios: modificación del balance anterior invalida también el año siguiente', async () => {
  const e = preparar(2, [2090, 2091])
  await recalcularRatios(2, 2090); await recalcularRatios(2, 2091)
  e.lineas.find(l => l.anio === 2090 && l.codigo === '1101').saldo++
  assert.equal((await recalcularRatios(2, 2090)).calculados, 23)
  assert.equal((await recalcularRatios(2, 2091)).calculados, 23)
  assert.equal((await recalcularRatios(2, 2091)).omitidos, 23)
})
test('ratios: referencia, resultados editados, versión y forzado invalidan la reutilización', async () => {
  const e = preparar(3)
  await recalcularRatios(3, 2090)
  e.ratios[0].parametroSector.valor_referencia = 0.2
  assert.equal((await recalcularRatios(3, 2090)).calculados, 23)
  e.ratios[0].valor_calculado = 999
  assert.equal((await recalcularRatios(3, 2090)).calculados, 23)
  firmas.get('3/2090').version = VERSION_CALCULO_RATIOS + '-anterior'
  assert.equal((await recalcularRatios(3, 2090)).calculados, 23)
  assert.equal((await recalcularRatios(3, 2090, true)).calculados, 23)
})
test('ratios: N/M es resultado válido y se reutiliza; un fallo real se vuelve a intentar', async () => {
  const e = preparar(4)
  e.lineas.find(l => l.codigo === '3101').saldo = -100
  assert.equal((await recalcularRatios(4, 2090)).fallos.length, 0)
  assert.equal((await recalcularRatios(4, 2090)).omitidos, 23)
  e.lineas.filter(l => l.codigo.startsWith('1')).forEach(l => { l.saldo = 0 })
  const fallido = await recalcularRatios(4, 2090)
  assert.ok(fallido.fallos.length > 0)
  assert.ok(!firmas.has('4/2090'))
  assert.ok((await recalcularRatios(4, 2090)).fallos.length > 0)
})
test('ratios: dos empresas concurrentes conservan sus bases separadas', async () => {
  preparar(5); const otra = preparar(6)
  otra.lineas.find(l => l.codigo === '5101.01').saldo *= 2
  await Promise.all([recalcularRatios(5, 2090), recalcularRatios(6, 2090)])
  const roa = id => empresas.get(id).ratios.find(r => r.categoriaRatio.nombre_tipo === 'Rendimiento sobre activos (ROA)').valor_calculado
  assert.notEqual(roa(5), roa(6))
})
test('ratios: si los datos cambian al guardar, no se marca como actualizado', async () => {
  preparar(7); cambioConcurrente = true
  try { await assert.rejects(recalcularRatios(7, 2090), /datos cambiaron/); assert.ok(!firmas.has('7/2090')) }
  finally { cambioConcurrente = false }
})
