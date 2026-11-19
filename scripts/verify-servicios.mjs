// Read-only checks against the configured Supabase. Never calls Gemini.
import nextEnv from '@next/env'
import assert from 'node:assert/strict'
nextEnv.loadEnvConfig(process.cwd())
const { supabaseAdmin } = await import('../src/lib/supabase/admin.ts')
const { getEmpresaPrincipal } = await import('../src/lib/empresaPrincipal.ts')
const { obtenerBaseFinanciera } = await import('../src/lib/baseFinanciera.ts')
const { calcularEvolucionRatios } = await import('../src/lib/analisis.ts')
const { pronosticarVentas } = await import('../src/lib/pronosticos.ts')
const { generarProforma } = await import('../src/lib/proforma.ts')
const { saldoPromedio, utilidadEjercicio } = await import('../src/lib/rentabilidad.ts')
const { ratiosDelAnio } = await import('../src/lib/asistenteFinanciero.ts')
for (const tabla of ['presupuesto', 'evaluacion_capital', 'inventario_producto']) {
  const { error } = await supabaseAdmin.from(tabla).select('*').limit(1)
  assert.equal(error, null, `Migración pendiente: ${tabla}`)
  console.log('PASS tabla ' + tabla)
}
const { empresaId } = await getEmpresaPrincipal()
const base = await obtenerBaseFinanciera(empresaId)
assert.ok(base.tieneBalance && base.tieneResultados)
const anterior = base.anios.includes(base.anio - 1) ? await obtenerBaseFinanciera(empresaId, base.anio - 1) : null
assert.equal(base.activoPromedio, saldoPromedio(base.activos, anterior?.activos ?? null))
assert.equal(base.utilidad, utilidadEjercicio(base.tieneResultados, base.ingresos, base.costosGastos, 0))
const evolucion = (await calcularEvolucionRatios(empresaId, ['ROA', 'ROE'])).find(f => Number(f.get('anio')) === base.anio)
assert.ok(Math.abs(evolucion.get('ROA') - base.utilidad / base.activoPromedio * 100) < 0.011)
console.log('PASS B-C-D: denominadores y resultado del ejercicio compartidos')
const ratios = await ratiosDelAnio(empresaId, base.anio)
assert.ok(ratios.length)
console.log('PASS C-E: lectura de ratios y relaciones sectoriales')
const proforma = generarProforma(base, { ventasProyectadas: base.ventas * 1.1, retencion: 100, porcentajeVariableGastos: 0 })
assert.ok(Math.abs(proforma.diferencia) < 1e-6)
console.log('PASS D5: estados proforma reales y balance cuadrado')
const ventas = await supabaseAdmin.from('venta').select('*').eq('empresa_id', empresaId)
assert.equal(ventas.error, null)
assert.equal(pronosticarVentas(ventas.data, 'anual', 3).proyecciones.length, 3)
console.log('PASS A-D: ventas anuales reales y tres métodos avanzados')
const bucket = await supabaseAdmin.storage.getBucket('excel-uploads')
assert.equal(bucket.error, null, 'Falta el bucket excel-uploads o no se puede consultar')
assert.equal(bucket.data.public, false, 'El archivo original debe estar en un bucket privado')
const archivos = await supabaseAdmin.storage.from('excel-uploads').list('estados-financieros', { limit: 1 })
assert.equal(archivos.error, null, 'No se puede consultar el archivo de Excel')
console.log('PASS Storage: bucket privado excel-uploads disponible (lectura, sin subir archivos)')
const esquema = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, Accept: 'application/openapi+json' },
})
assert.equal(esquema.ok, true, 'No se pudo consultar el esquema de la API de Supabase')
const api = await esquema.json()
for (const rpc of ['cargar_estados_financieros', 'asegurar_ratios_anio', 'reservar_cache_ia', 'guardar_ventas_mensuales']) {
  assert.ok(api.paths?.[`/rpc/${rpc}`], `Falta la función ${rpc}`)
  console.log('PASS RPC disponible: ' + rpc + ' (no ejecutada)')
}
const categorias = await supabaseAdmin.from('categoria_ratio').select('nombre_tipo')
assert.equal(categorias.error, null)
assert.ok(categorias.data.length >= 23, 'Falta completar el catálogo con la migración 009')
console.log(`Categorías de ratios disponibles: ${categorias.data.length}. Clave de Gemini configurada: ${Boolean(process.env.GEMINI_API_KEY)} (sin llamadas).`)
const filasRatios = await supabaseAdmin.from('ratio').select('anio_ratio, id_categoria_ratio, id_parametro_sector, valor_calculado').eq('empresa_id', empresaId)
assert.equal(filasRatios.error, null)
console.log(JSON.stringify({ coberturaRatios: base.anios.map(anio => {
  const filas = filasRatios.data.filter(f => Number(f.anio_ratio) === anio)
  return { anio, categoriasConRegistro: new Set(filas.map(f => f.id_categoria_ratio)).size, categoriasCatalogo: categorias.data.length, calculados: filas.filter(f => f.valor_calculado !== null).length, sinReferencia: filas.filter(f => f.id_parametro_sector === null).length }
}) }))
