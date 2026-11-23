// Real Excel fixtures through A/B/C/D functions. All Supabase traffic is intercepted.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://excel-test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
let actual
const estados = () => ['BALANCE_GENERAL', 'ESTADO_RESULTADOS'].map(tipo_reporte => ({ anio: actual.anio, tipo_reporte }))
const close = (a, b, tolerancia = 0.011) => assert.ok(Math.abs(a - b) < tolerancia, `${a} != ${b}`)
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href)
  assert.equal(url.hostname, 'excel-test.invalid')
  const nombre = url.pathname.split('/').at(-1)
  const json = valor => new Response(JSON.stringify(valor), { headers: { 'Content-Type': 'application/json' } })
  if (nombre === 'cont_periodo') return json([])
  const anio = Number((url.searchParams.get('estado_financiero.anio') ?? url.searchParams.get('anio') ?? `eq.${actual.anio}`).replace('eq.', ''))
  if (nombre === 'estado_financiero') {
    if (init.method === 'HEAD') return new Response(null, { headers: { 'Content-Range': `0-0/${anio === actual.anio ? 1 : 0}` } })
    return json(estados())
  }
  if (nombre === 'linea_estado_financiero') {
    const tipo = url.searchParams.get('estado_financiero.tipo_reporte')?.replace('eq.', '')
    const prefijo = url.searchParams.get('cuenta.cue_cuenta_id')?.replace('like.', '').replace('%', '') ?? ''
    const lineas = anio !== actual.anio ? [] : tipo === 'BALANCE_GENERAL' ? actual.balance : actual.resultados
    return json(lineas.filter(l => l.codigoCuenta.startsWith(prefijo)).map((l, i) => ({ id_linea: i + 1, saldo: l.saldo, cuenta: { cue_cuenta_id: l.codigoCuenta, nombre_cuenta: l.codigoCuenta } })))
  }
  if (nombre === 'ratio') {
    const ratio = { id_ratio: 1, anio_ratio: actual.anio, empresa_id: 1, categoria_ratio: { nombre_tipo: 'Rendimiento sobre activos (ROA)' }, parametro_sector: null }
    return json(init.method === 'PATCH' ? { ...ratio, ...JSON.parse(init.body) } : ratio)
  }
  if (nombre === 'cont_periodo') return json([])
  if (nombre === 'cont_publicacion') return json([])
  if (nombre === 'empresa') return json({ empresa_id: 1, nombre_empresa: 'Prueba' })
  throw new Error(`Petición inesperada: ${nombre}`)
}
const { readWorkbook, parseBalanzaComprobacion, resumirCarga } = await import('../src/lib/excel.ts')
const { obtenerBaseFinanciera } = await import('../src/lib/baseFinanciera.ts')
const { calcularEvolucionRatios } = await import('../src/lib/analisis.ts')
const { calcularROA } = await import('../src/lib/ratios.ts')
const { generarProforma } = await import('../src/lib/proforma.ts')
for (const anio of [2020, 2021, 2023, 2024, 2025]) {
  test(`Excel ${anio}: misma utilidad en A, B, C y Proforma D sin crecimiento`, async () => {
    const archivo = anio < 2023 ? `public/templates/ejemplo_estados_${anio}.xlsx` : `scripts/fixtures/Plantilla_Balance_Comprobacion_${anio}_Empresa_2.xlsx`
    const buf = readFileSync(archivo)
    actual = parseBalanzaComprobacion(readWorkbook(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)))
    const resumen = resumirCarga(actual.balance, actual.resultados)
    const base = await obtenerBaseFinanciera(1, anio)
    close(base.utilidad, resumen.utilidadNeta)
    close(base.ingresos, resumen.totalIngresos)
    close(base.ventas, resumen.ventasNetas)
    const evolucion = await calcularEvolucionRatios(1, ['ROA'])
    close(evolucion[0].get('ROA'), resumen.utilidadNeta / resumen.totalActivo * 100)
    const ratio = await (await calcularROA(1)).json()
    close(ratio.valor_calculado, resumen.utilidadNeta / resumen.totalActivo, 0.0001)
    const proforma = generarProforma(base, { ventasProyectadas: base.ventas, retencion: 100, porcentajeVariableGastos: 0 })
    close(proforma.utilidad, resumen.utilidadNeta)
    close(proforma.diferencia, 0)
    if (anio === 2020) close(proforma.utilidad, 100000)
  })
}
