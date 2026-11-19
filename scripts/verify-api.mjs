// HTTP contracts and permissions using real Route Handlers and a local Supabase double.
// Every fetch is intercepted; these tests cannot reach production or Gemini.
import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://integration.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
let rol = 'ADMIN', accesos = [], sequence = 0, nextId = 1
const documentos = new Map()
let escenarioRatios = null
const tabla = nombre => { if (!documentos.has(nombre)) documentos.set(nombre, new Map()); return documentos.get(nombre) }
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href)
  assert.equal(url.hostname, 'integration.invalid', 'Las pruebas nunca deben llamar servicios externos')
  const options = init
  const method = options.method ?? 'GET'
  const json = valor => new Response(JSON.stringify(valor), { status: 200, headers: { 'Content-Type': 'application/json' } })
  if (url.pathname === '/auth/v1/user') return json({ id: 'test-user', aud: 'authenticated', email: 'integration@example.invalid' })
  const nombre = url.pathname.split('/').at(-1)
  if (nombre === 'usuario') return json({ usuario_id: 1, user_name: 'integration', rol })
  if (nombre === 'acceso_usuario') return json(accesos.map(id => ({ id_opcion: String(id) })))
  if (nombre === 'empresa') return json({ empresa_id: 1, nombre_empresa: 'Prueba aislada', id_sector: 1 })
  if (escenarioRatios && nombre === 'estado_financiero') return json([{ anio: 2099 }])
  if (escenarioRatios && nombre === 'asegurar_ratios_anio') { escenarioRatios.preparado = true; return json(1) }
  if (escenarioRatios && nombre === 'ratio') {
    if (method === 'PATCH') { escenarioRatios.invalidacion = JSON.parse(options.body); return new Response(null, { status: 204 }) }
    if (url.searchParams.has('id_ratio')) return json({ id_ratio: 1, anio_ratio: 2099, empresa_id: 1, categoria_ratio: { id_categoria_ratio: 1, nombre_tipo: 'Rendimiento sobre activos (ROA)' }, parametro_sector: null })
    return json([{ id_ratio: 1, categoria_ratio: { nombre_tipo: 'Rendimiento sobre activos (ROA)' } }])
  }
  if (escenarioRatios && nombre === 'linea_estado_financiero') return new Response(JSON.stringify({ code: 'TEST', message: 'Fallo controlado de datos' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  if (nombre === 'inventario_producto') return json([])
  if (['presupuesto', 'evaluacion_capital'].includes(nombre)) {
    const idCampo = nombre === 'presupuesto' ? 'id_presupuesto' : 'id_evaluacion'
    const filtro = url.searchParams.get(idCampo)
    const id = filtro ? Number(filtro.replace('eq.', '')) : null
    const filas = tabla(nombre)
    if (method === 'POST') {
      const body = JSON.parse(options.body)
      const nuevo = { ...body, [idCampo]: nextId++, creado_en: new Date().toISOString(), actualizado_en: new Date().toISOString() }
      filas.set(nuevo[idCampo], nuevo)
      return json(nuevo)
    }
    if (method === 'PATCH') { const row = { ...filas.get(id), ...JSON.parse(options.body) }; filas.set(id, row); return json(row) }
    if (method === 'DELETE') { const row = filas.get(id); filas.delete(id); return json(row ? [{ [idCampo]: id }] : []) }
    return json(id ? filas.get(id) ?? null : [...filas.values()])
  }
  throw new Error('Consulta no contemplada por el escenario: ' + url.pathname)
}
const inventario = await import('../src/app/api/v1/inventarios/route.ts')
const presupuesto = await import('../src/app/api/v1/presupuestos/route.ts')
const presupuestoId = await import('../src/app/api/v1/presupuestos/[id]/route.ts')
const capital = await import('../src/app/api/v1/evaluaciones-capital/route.ts')
const capitalId = await import('../src/app/api/v1/evaluaciones-capital/[id]/route.ts')
const resumen = await import('../src/app/api/v1/resumen-ia/route.ts')
const { supuestosEjemplo } = await import('../src/lib/presupuesto.ts')
const { capitalEjemplo } = await import('../src/lib/capital.ts')
function request(path, method = 'GET', body, autenticado = true) {
  return new Request('http://localhost/api/v1/' + path, { method, headers: { ...(autenticado ? { Authorization: `Bearer integration-token-${++sequence}` } : {}), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
}
test('API: sin sesión devuelve 401', async () => {
  assert.equal((await inventario.GET(request('inventarios', 'GET', undefined, false))).status, 401)
})
test('API: inventarios exige permiso del módulo tanto al leer como escribir', async () => {
  rol = 'USER'; accesos = [6]
  assert.equal((await inventario.GET(request('inventarios'))).status, 403)
  assert.equal((await inventario.POST(request('inventarios', 'POST', {}))).status, 403)
  accesos = [3]
  assert.equal((await inventario.GET(request('inventarios'))).status, 200)
})
test('API: usuario sin Proyecciones no puede guardar presupuestos ni capital', async () => {
  rol = 'USER'; accesos = [3]
  assert.equal((await presupuesto.POST(request('presupuestos', 'POST', {}))).status, 403)
  assert.equal((await capital.POST(request('evaluaciones-capital', 'POST', {}))).status, 403)
})
test('API: JSON null es 400 en presupuestos y resumen; no llama a Gemini', async () => {
  rol = 'ADMIN'
  assert.equal((await presupuesto.POST(request('presupuestos', 'POST', null))).status, 400)
  assert.equal((await resumen.POST(request('resumen-ia', 'POST', null))).status, 400)
})
test('E: crear, listar, abrir, modificar y borrar ambos tipos de documentos', async () => {
  rol = 'USER'; accesos = [6]
  for (const [path, collection, item, datos] of [['presupuestos', presupuesto, presupuestoId, supuestosEjemplo(2027)], ['evaluaciones-capital', capital, capitalId, capitalEjemplo()]]) {
    const crear = await collection.POST(request(path, 'POST', { empresaId: 1, nombre: 'Prueba integrada', datos }))
    assert.equal(crear.status, 201, await crear.clone().text())
    const creado = await crear.json()
    const params = { params: Promise.resolve({ id: String(creado.id) }) }
    const listar = await collection.GET(request(path + '?empresaId=1'))
    assert.equal((await listar.json()).length, 1)
    const abrir = await item.GET(request(`${path}/${creado.id}`), params)
    assert.deepEqual((await abrir.json()).datos, datos)
    const actualizar = await item.PUT(request(`${path}/${creado.id}`, 'PUT', { nombre: 'Editado', datos }), params)
    assert.equal(actualizar.status, 200)
    const editado = await item.GET(request(`${path}/${creado.id}`), params)
    assert.equal((await editado.json()).nombre, 'Editado')
    const borrar = await item.DELETE(request(`${path}/${creado.id}`, 'DELETE'), params)
    assert.ok([200, 204].includes(borrar.status))
    assert.equal((await item.GET(request(`${path}/${creado.id}`), params)).status, 404)
  }
})

test('AU1: prepara filas faltantes y registra/invalida indicadores que no pudieron recalcularse', async () => {
  const { recalcularRatios } = await import('../src/lib/ratios.ts')
  escenarioRatios = { preparado: false, invalidacion: null }
  const log = console.error
  console.error = () => {}
  try {
    const resultado = await recalcularRatios(1, 2099)
    assert.equal(escenarioRatios.preparado, true)
    assert.equal(resultado.fallos.length, 1)
    assert.ok(resultado.avisos.length)
    assert.equal(escenarioRatios.invalidacion.valor_calculado, null)
    assert.ok(escenarioRatios.invalidacion.interpretacion.includes('Pendiente de recálculo'))
  } finally { console.error = log; escenarioRatios = null }
})
