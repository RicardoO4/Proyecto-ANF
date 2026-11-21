// Real Supabase integration. Uses ONLY previously empty 2093/2094 fixtures.
// Cleans its own records. Never calls Gemini.
import nextEnv from '@next/env'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
nextEnv.loadEnvConfig(process.cwd())
const { supabaseAdmin: db } = await import('../src/lib/supabase/admin.ts')
const { getEmpresaPrincipal } = await import('../src/lib/empresaPrincipal.ts')
const { recalcularRatios, VERSION_CALCULO_RATIOS } = await import('../src/lib/ratios.ts')
const { empresaId } = await getEmpresaPrincipal()
const years = [2093, 2094], marker = 'recalculo-' + randomUUID()
let reservado = false, parametroId
const ok = r => { assert.equal(r.error, null, r.error?.message); return r.data }
const tiempos = []
async function calcular(anio, forzar = false) {
  const inicio = performance.now()
  const r = await recalcularRatios(empresaId, anio, forzar)
  tiempos.push({ anio, forzar, calculados: r.calculados, omitidos: r.omitidos, ms: Math.round(performance.now() - inicio) })
  assert.deepEqual(r.fallos, [])
  return r
}
try {
  // Read before reserving: never delete or overwrite another test or real record.
  for (const [tabla, columna] of [['estado_financiero', 'anio'], ['ratio', 'anio_ratio'], ['ratio_recalculo', 'anio']]) {
    assert.equal(ok(await db.from(tabla).select('*').eq('empresa_id', empresaId).in(columna, years)).length, 0, `Los años reservados ya tienen datos en ${tabla}`)
  }
  assert.equal(ok(await db.from('venta').select('id_venta').eq('empresa_id', empresaId).gte('fecha_venta', '2093-01-01').lt('fecha_venta', '2095-01-01')).length, 0)
  const balance = [['1101.01', 100], ['1105', 600], ['1201', 300], ['2102', 500], ['3101', 500]]
  const resultados = [['5101.01', 1000], ['4101', 600], ['4102', 190], ['4201', 10]]
  const cuentas = ok(await db.from('cuenta').select('cuenta_id, cue_cuenta_id').in('cue_cuenta_id', [...balance, ...resultados].map(([c]) => c)))
  const ids = new Map(cuentas.map(c => [c.cue_cuenta_id, c.cuenta_id]))
  for (const [c] of [...balance, ...resultados]) assert.ok(ids.has(c), `Falta cuenta ${c}`)
  reservado = true
  for (const anio of years) {
    const factor = anio === years[1] ? 2 : 1
    ok(await db.rpc('cargar_estados_financieros', { p_empresa_id: empresaId, p_anio: anio, p_balance: balance.map(([c, s]) => ({ cuentaId: ids.get(c), saldo: s * factor })), p_resultados: resultados.map(([c, s]) => ({ cuentaId: ids.get(c), saldo: s })), p_venta: 1000, p_reemplazar: false }))
    assert.equal((await calcular(anio)).calculados, 23)
    assert.equal((await calcular(anio)).omitidos, 23)
  }
  console.log('PASS SQL real: primer cálculo guarda 23; segundo omite 23 sin recalcular')
  const estado = ok(await db.from('estado_financiero').select('id_estado_financiero').eq('empresa_id', empresaId).eq('anio', years[0]).eq('tipo_reporte', 'BALANCE_GENERAL').single())
  ok(await db.from('linea_estado_financiero').update({ saldo: 110 }).eq('id_estado_financiero', estado.id_estado_financiero).eq('cuenta_id', ids.get('1101.01')))
  assert.equal((await calcular(years[0])).calculados, 23)
  assert.equal((await calcular(years[1])).calculados, 23)
  console.log('PASS SQL real: cambiar balance invalida ese año y el siguiente')
  const categoria = ok(await db.from('categoria_ratio').select('id_categoria_ratio').eq('nombre_tipo', 'Rendimiento sobre activos (ROA)').single())
  const empresa = ok(await db.from('empresa').select('id_sector').eq('empresa_id', empresaId).single())
  const parametro = ok(await db.from('parametro_sector').insert({ nombre_ratio: 'Prueba de recálculo', valor_referencia: 0.1, fuente: marker, anio_referencia: years[0], id_sector: empresa.id_sector, id_categoria_ratio: categoria.id_categoria_ratio }).select('id_parametro_sector').single())
  parametroId = parametro.id_parametro_sector
  const fila = ok(await db.from('ratio').select('id_ratio').eq('empresa_id', empresaId).eq('anio_ratio', years[0]).eq('id_categoria_ratio', categoria.id_categoria_ratio).single())
  ok(await db.from('ratio').update({ id_parametro_sector: parametroId }).eq('id_ratio', fila.id_ratio))
  assert.equal((await calcular(years[0])).calculados, 23)
  ok(await db.from('parametro_sector').update({ valor_referencia: 0.2 }).eq('id_parametro_sector', parametroId))
  assert.equal((await calcular(years[0])).calculados, 23)
  ok(await db.from('ratio').update({ valor_calculado: 999 }).eq('id_ratio', fila.id_ratio))
  assert.equal((await calcular(years[0])).calculados, 23)
  ok(await db.from('ratio_recalculo').update({ version: 'prueba-anterior' }).eq('empresa_id', empresaId).eq('anio', years[0]))
  assert.equal((await calcular(years[0])).calculados, 23)
  assert.equal((await calcular(years[0], true)).calculados, 23)
  console.log('PASS SQL real: cambios de referencia, valor guardado, versión y forzado')
  const snapshot = ok(await db.rpc('consultar_recalculo_ratios', { p_empresa_id: empresaId, p_anio: years[0], p_version: VERSION_CALCULO_RATIOS }))
  ok(await db.from('linea_estado_financiero').update({ saldo: 120 }).eq('id_estado_financiero', estado.id_estado_financiero).eq('cuenta_id', ids.get('1101.01')))
  const guardar = await db.rpc('guardar_recalculo_ratios', { p_empresa_id: empresaId, p_anio: years[0], p_version: VERSION_CALCULO_RATIOS, p_huella: snapshot.huella, p_filas: [], p_completo: true })
  assert.equal(guardar.error?.code, 'ANF03')
  console.log('PASS SQL real: rechaza guardar un cálculo con datos que ya cambiaron')
  console.log(JSON.stringify({ tiempos, gemini: false }))
} finally {
  if (reservado) {
    for (const [tabla, columna] of [['ratio_recalculo', 'anio'], ['ratio', 'anio_ratio'], ['estado_financiero', 'anio']]) ok(await db.from(tabla).delete().eq('empresa_id', empresaId).in(columna, years))
    ok(await db.from('venta').delete().eq('empresa_id', empresaId).gte('fecha_venta', '2093-01-01').lt('fecha_venta', '2095-01-01').like('observacion', 'Generado desde estados financieros %'))
  }
  if (parametroId) ok(await db.from('parametro_sector').delete().eq('id_parametro_sector', parametroId).eq('fuente', marker))
  console.log('Limpieza de filas propias terminada')
}
