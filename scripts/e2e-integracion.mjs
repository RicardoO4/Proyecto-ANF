// Run against a local server connected to Supabase. No Gemini calls.
// Uses unique documents/products and empty years 2097/2098; cleans ONLY its own fixtures.
import nextEnv from '@next/env'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import * as XLSX from 'xlsx'
nextEnv.loadEnvConfig(process.cwd())
const { supabaseAdmin } = await import('../src/lib/supabase/admin.ts')
const { supuestosEjemplo } = await import('../src/lib/presupuesto.ts')
const { capitalEjemplo } = await import('../src/lib/capital.ts')
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'
const marker = 'e2e-' + randomUUID()
const years = [2097, 2098]
const documentos = []
let productoId = null, empresaId, token, reservar = false
async function api(path, method = 'GET', body) {
  const form = body instanceof FormData
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(!form && body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: body === undefined ? undefined : form ? body : JSON.stringify(body) })
  const text = await response.text()
  let data
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  assert.ok(response.ok, `${method} ${path}: ${response.status}; ${data?.message ?? 'Respuesta inesperada'} ${JSON.stringify(data?.detalles ?? [])}`)
  return data
}
function pass(label) { console.log('PASS ' + label) }
try {
  const unauthorized = await fetch(base + '/api/v1/inventarios')
  assert.equal(unauthorized.status, 401)
  pass('sin sesión no accede a inventarios')
  const login = await api('/api/auth/login', 'POST', { userName: process.env.E2E_USER ?? 'admin', contrasena: process.env.E2E_PASSWORD ?? 'admin123' })
  token = login.token
  assert.ok(token)
  const empresa = await api('/api/v1/empresas/principal')
  empresaId = empresa.empresaId
  pass('login y empresa principal reales')
  for (const [path, datos] of [['presupuestos', supuestosEjemplo(2027)], ['evaluaciones-capital', capitalEjemplo()]]) {
    const created = await api('/api/v1/' + path, 'POST', { empresaId, nombre: marker, datos })
    documentos.push([path, created.id])
    const opened = await api(`/api/v1/${path}/${created.id}`)
    assert.deepEqual(opened.datos, datos)
    await api(`/api/v1/${path}/${created.id}`, 'PUT', { nombre: marker + '-editado', datos })
    assert.equal((await api(`/api/v1/${path}/${created.id}`)).nombre, marker + '-editado')
    pass('guardar, abrir y actualizar ' + path)
  }
  const producto = { codigo: marker, nombre: 'Producto de integración', demanda_anual: 1000, costo_unitario: 10, costo_pedido: 20, costo_mantenimiento_anual: 2, plazo_entrega_dias: 10, stock_seguridad: 5, dias_operacion: 250, existencias: 10 }
  const created = await api('/api/v1/inventarios', 'POST', producto)
  productoId = created.id_producto
  const listado = await api('/api/v1/inventarios')
  const analisis = listado.find(p => p.codigo === marker)
  assert.equal(analisis.puntoReorden, 45)
  assert.ok(Math.abs(analisis.eoq - Math.sqrt(20000)) < 0.001)
  await api('/api/v1/inventarios', 'PUT', { ...producto, id_producto: productoId, existencias: 100 })
  pass('inventario persistido, ABC/EOQ/reorden y edición')
  const libre = await supabaseAdmin.from('estado_financiero').select('anio').eq('empresa_id', empresaId).in('anio', years)
  assert.equal(libre.error, null)
  assert.equal(libre.data.length, 0, 'Los años de prueba ya tienen estados: no se modifica nada de ellos.')
  const ratiosLibres = await supabaseAdmin.from('ratio').select('id_ratio').eq('empresa_id', empresaId).in('anio_ratio', years)
  assert.equal(ratiosLibres.error, null)
  assert.equal(ratiosLibres.data.length, 0, 'Los años de prueba ya tienen ratios.')
  const ventasLibres = await supabaseAdmin.from('venta').select('id_venta').eq('empresa_id', empresaId).gte('fecha_venta', '2097-01-01').lte('fecha_venta', '2098-12-31')
  assert.equal(ventasLibres.error, null); assert.equal(ventasLibres.data.length, 0)
  reservar = true
  // Load the later year first to verify that loading its predecessor refreshes it.
  for (const anio of [...years].reverse()) {
    const factor = anio === 2098 ? 2 : 1
    const wb = XLSX.utils.book_new()
    for (const [name, rows] of [
      ['metadata', [['campo', 'valor'], ['anio', anio], ['empresa_id', empresaId]]],
      ['balance', [['Codigo', 'Saldo'], ['1101.01', 100 * factor], ['1105', 600 * factor], ['1201', 300 * factor], ['2102', 500 * factor], ['3101', 500 * factor]]],
      ['resultados', [['Codigo', 'Saldo'], ['5101.01', 1000], ['4101', 600], ['4102', 200]]],
    ]) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
    const form = new FormData()
    form.append('file', new Blob([XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${marker}-${anio}.xlsx`)
    const carga = await api('/api/v1/estados-financieros/upload', 'POST', form)
    assert.equal(carga.anio, anio)
    const filas = await supabaseAdmin.from('ratio').select('id_ratio').eq('empresa_id', empresaId).eq('anio_ratio', anio)
    assert.equal(filas.error, null); assert.equal(filas.data.length, 23)
    pass(`carga ${anio} crea sus 23 indicadores automáticamente`)
  }
  const ratio = await supabaseAdmin.from('ratio').select('valor_calculado, categoria_ratio!inner(nombre_tipo)').eq('empresa_id', empresaId).eq('anio_ratio', 2098).eq('categoria_ratio.nombre_tipo', 'Rendimiento sobre activos (ROA)').single()
  assert.equal(ratio.error, null)
  assert.ok(Math.abs(Number(ratio.data.valor_calculado) - 0.1333) < 0.0001)
  const evolucion = await api(`/api/v1/analisis/evolucion-ratios?empresaId=${empresaId}&ratios=ROA,ROE`)
  assert.ok(Math.abs(evolucion.find(f => Number(f.anio) === 2098).ROA - 13.33) < 0.011)
  pass('cargar el año anterior actualiza ROA del siguiente; B y C coinciden')
  await api('/api/v1/analisis/base-financiera?anio=2098')
  pass('base financiera de DuPont y Proforma disponible desde API')
} finally {
  const fallos = []
  for (const [path, id] of documentos) {
    try { await api(`/api/v1/${path}/${id}`, 'DELETE') } catch { fallos.push(path + '/' + id) }
  }
  if (productoId) { try { await api(`/api/v1/inventarios?id=${productoId}`, 'DELETE') } catch { fallos.push('inventario/' + productoId) } }
  if (reservar) {
    for (const [tabla, columna] of [['ratio_recalculo', 'anio'], ['ratio', 'anio_ratio'], ['estado_financiero', 'anio']]) {
      const { error } = await supabaseAdmin.from(tabla).delete().eq('empresa_id', empresaId).in(columna, years)
      if (error) fallos.push(tabla + ': años 2097/2098')
    }
    const { error } = await supabaseAdmin.from('venta').delete().eq('empresa_id', empresaId).gte('fecha_venta', '2097-01-01').lte('fecha_venta', '2098-12-31').like('observacion', 'Generado desde estados financieros %')
    if (error) fallos.push('ventas de los años de prueba')
  }
  const storage = supabaseAdmin.storage.from('excel-uploads')
  const files = await storage.list('estados-financieros', { search: marker, limit: 100 })
  if (files.error) fallos.push('consulta de archivos de prueba')
  else if (files.data.length) {
    const propios = files.data.filter(f => f.name.includes(marker)).map(f => 'estados-financieros/' + f.name)
    if (propios.length) { const { error } = await storage.remove(propios); if (error) fallos.push('archivos ' + marker) }
  }
  assert.deepEqual(fallos, [], 'Limpieza pendiente: ' + fallos.join(', '))
  pass('limpieza de documentos, productos, estados, ratios, ventas y Excel de prueba')
}
