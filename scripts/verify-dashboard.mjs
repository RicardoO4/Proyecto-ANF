import test from 'node:test'
import assert from 'node:assert/strict'
import { resumirBaseFinanciera } from '../src/lib/resumenFinanciero.ts'
import { resumirDashboard, compararDashboard } from '../src/lib/dashboard.ts'

const mapa = valores => new Map(Object.entries(valores).map(([codigo, saldo]) => [codigo, { saldo, nombre: codigo }]))
const estados = [{ anio: 2026, tipo_reporte: 'BALANCE_GENERAL' }, { anio: 2026, tipo_reporte: 'ESTADO_RESULTADOS' }, { anio: 2025, tipo_reporte: 'BALANCE_GENERAL' }]
const base = (balance = {1101: 100, 1201: 900, 2101: 400, 3101: 600}, resultados = {'5101.01': 500, '5101.02': 20, '5201': 100, '4101': 300}, disponibles = estados) => resumirBaseFinanciera(2, 2026, disponibles, mapa(balance), mapa(resultados), mapa({1101: 800}))

test('Dashboard conserva las cifras, contracuentas y promedios del análisis financiero', () => {
  const b = base(), r = resumirDashboard(b)
  assert.equal(r.ventas, 480)
  assert.equal(r.ingresos, 580)
  assert.equal(r.costosGastos, 300)
  assert.equal(r.utilidad, 280)
  assert.equal(r.activos, 1000)
  assert.equal(r.efectivo, 100)
  assert.equal(r.endeudamiento, .4)
  assert.equal(r.liquidez, .25)
  assert.equal(b.activoPromedio, 900)
  assert.equal(r.rentabilidad, .3111)
  assert.equal(r.diferenciaBalance, 0)
})

test('Estado ausente o sin líneas no se representa como un cero real', () => {
  const r = resumirDashboard(base({}, {}, []))
  for (const campo of ['ventas','ingresos','utilidad','activos','efectivo','endeudamiento','liquidez','margen','rentabilidad']) assert.equal(r[campo], null, campo)
  const vacio = resumirDashboard(base({}, {}))
  assert.equal(vacio.tieneBalance, false)
  assert.equal(vacio.tieneResultados, false)
  const cero = resumirDashboard(base({1101: 0}, {'5101.01': 0, '4101': 200}))
  assert.equal(cero.ventas, 0)
  assert.equal(cero.utilidad, -200)
  assert.equal(cero.efectivo, 0)
  assert.equal(cero.margen, null)
  assert.equal(cero.endeudamiento, null)
  assert.equal(cero.liquidez, null)
})

test('Estado contable distingue histórico, final, provisional y cambios aún no publicados', () => {
  const periodo = {anio:2026, origen:'CONTABILIDAD', estado:'REVISION', version:5, version_publicada:4}
  assert.equal(resumirDashboard(base(), periodo).estado, 'PROVISIONAL')
  assert.equal(resumirDashboard(base(), periodo).cambiosPendientes, true)
  assert.equal(resumirDashboard(base(), {...periodo, estado:'CERRADO', version_publicada:5}).estado, 'FINAL')
  assert.equal(resumirDashboard(base(), {...periodo, origen:'HISTORICO'}).estado, 'HISTORICO')
  assert.equal(resumirDashboard({...base(), anio:2025}).estado, 'IMPORTADO')
})

test('Comparaciones evitan porcentajes con pérdidas, bases cero y ejercicios no comparables', () => {
  assert.equal(compararDashboard(20, 10, false), null)
  assert.equal(compararDashboard(null, 10, true), null)
  assert.deepEqual(compararDashboard(120, 100, true), {valor:20, unidad:'porcentaje'})
  assert.deepEqual(compararDashboard(10, -100, true), {valor:110, unidad:'moneda'})
  assert.deepEqual(compararDashboard(-50, 100, true), {valor:-150, unidad:'moneda'})
  assert.deepEqual(compararDashboard(10, 0, true), {valor:10, unidad:'moneda'})
  assert.ok(Math.abs(compararDashboard(.5, .4, true, true).valor - 10) < 1e-10)
})

test('Consulta aísla la empresa, pagina más de mil líneas y limita el histórico sin años futuros', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://dashboard.invalid'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  const original = globalThis.fetch, paginas = []
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? input.href)
    assert.equal(url.hostname, 'dashboard.invalid')
    assert.equal(init.method ?? 'GET', 'GET', 'El dashboard nunca escribe')
    const json = data => new Response(JSON.stringify(data), {headers:{'Content-Type':'application/json'}})
    if (url.pathname.endsWith('/estado_financiero')) {
      assert.equal(url.searchParams.get('empresa_id'), 'eq.2')
      return json(Array.from({length:8}, (_,i) => ({anio:2026-i, tipo_reporte:'BALANCE_GENERAL'})))
    }
    if (url.pathname.endsWith('/cont_periodo')) return json([])
    assert.ok(url.pathname.endsWith('/linea_estado_financiero'))
    assert.equal(url.searchParams.get('estado_financiero.empresa_id'), 'eq.2')
    assert.deepEqual(url.searchParams.get('estado_financiero.anio').slice(4,-1).split(',').map(Number).sort(), [2020,2021,2022,2023,2024,2025])
    const inicio = Number(url.searchParams.get('offset'))
    paginas.push(inicio)
    return json(Array.from({length:inicio === 0 ? 1000 : 1}, (_,i) => ({id_linea:inicio+i+1, saldo:1, estado_financiero:{anio:2025,tipo_reporte:'BALANCE_GENERAL'}, cuenta:{cue_cuenta_id:`1101.${inicio+i}`, nombre_cuenta:'Caja'}})))
  }
  try {
    const {obtenerDashboard} = await import('../src/lib/dashboardServidor.ts')
    const r = await obtenerDashboard({empresaId:2,nombreEmpresa:'Prueba',idSector:null},2025)
    assert.deepEqual(paginas,[0,1000])
    assert.equal(r.seleccionado.efectivo,1001)
    assert.deepEqual(r.historico.map(x=>x.anio),[2021,2022,2023,2024,2025])
    assert.equal(r.anterior.anio,2024)
  } finally { globalThis.fetch = original }
})
