// Regresiones numéricas. Solo datos en memoria; ninguna petición a producción.
import test from 'node:test'
import assert from 'node:assert/strict'
import { calcularPresupuesto, supuestosEjemplo } from '../src/lib/presupuesto.ts'
import { evaluarProyecto, flujosProyecto, tir, van } from '../src/lib/capital.ts'
import { calcularPuntoEquilibrio } from '../src/lib/equilibrio.ts'
import { formatearPorcentajeAnalisis } from '../src/lib/porcentajesAnalisis.ts'

const cerca = (actual, esperado, tolerancia = 1e-6) => assert.ok(Math.abs(actual - esperado) <= tolerancia, `${actual} != ${esperado}`)

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://matematicas-test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
const datos = {
  2090: { BALANCE_GENERAL: [['1101', 100], ['2101', 0], ['3101', 0]], ESTADO_RESULTADOS: [['5101.01', 0], ['4101', 20]] },
  2091: { BALANCE_GENERAL: [['1101', 0], ['2101', 300], ['3101', 0]], ESTADO_RESULTADOS: [['5101.01', 100], ['4101', 20]] },
}
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href)
  assert.equal(url.hostname, 'matematicas-test.invalid')
  assert.equal(init?.method ?? 'GET', 'GET')
  assert.ok(url.pathname.endsWith('/linea_estado_financiero'))
  const anio = Number(url.searchParams.get('estado_financiero.anio').slice(3))
  const tipo = url.searchParams.get('estado_financiero.tipo_reporte').slice(3)
  const rows = datos[anio][tipo].map(([cue_cuenta_id, saldo], i) => ({ id_linea: i + 1, saldo, cuenta: { cue_cuenta_id, nombre_cuenta: cue_cuenta_id } }))
  return Response.json(rows)
}
const { generarReporteInterno } = await import('../src/lib/analisis.ts')

test('horizontal y vertical: ambos ceros muestran 0 %, importe no cero con base cero es null', async () => {
  const r = await generarReporteInterno(2, 2090, 2091)
  const nuevo = r.analisisHorizontal.find(l => l.codigoCuenta === '2101')
  assert.equal(nuevo.variacionAbsoluta, 300)
  assert.equal(nuevo.variacionRelativa, null)
  const banco = r.analisisHorizontal.find(l => l.codigoCuenta === '1101')
  assert.equal(banco.variacionRelativa, -100)
  assert.equal(banco.porcentajeVerticalAnio1, 100)
  assert.equal(banco.porcentajeVerticalAnio2, 0)
  assert.equal(r.analisisHorizontal.find(l => l.codigoCuenta === '3101').variacionRelativa, 0)
  assert.equal(nuevo.porcentajeVerticalAnio2, null)
  const costo = r.analisisVertical.find(l => l.codigoCuenta === '4101')
  assert.equal(costo.porcentajeVerticalAnio1, null)
  assert.equal(costo.porcentajeVerticalAnio2, 20)
  assert.equal(costo.variacionRelativa, 0)
  const ventas = r.analisisVertical.find(l => l.codigoCuenta === '5101.01')
  assert.equal(ventas.porcentajeVerticalAnio1, 0)
  assert.equal(ventas.porcentajeVerticalAnio2, 100)
  assert.equal(formatearPorcentajeAnalisis(null), 'No calculable: base cero')
  assert.equal(formatearPorcentajeAnalisis(0), '0.00%')
  const serializado = JSON.parse(JSON.stringify(r))
  assert.equal(serializado.analisisHorizontal.find(l => l.codigoCuenta === '2101').variacionRelativa, null)
})

test('presupuesto: excedente de productos se consume antes de volver a producir', () => {
  const s = supuestosEjemplo()
  s.ventas.unidades = Array(12).fill(100)
  s.ventas.unidadesEneroSiguiente = 100
  s.inventarioProducto = { inicialUnidades: 1000, porcentajeFinal: 0 }
  const p = calcularPresupuesto(s)
  assert.deepEqual(p.produccion.inventarioFinal.slice(0, 3), [900, 800, 700])
  assert.deepEqual(p.produccion.aProducir, [...Array(10).fill(0), 100, 100])
  for (let m = 0; m < 12; m++) {
    cerca(p.produccion.inventarioInicial[m] + p.produccion.aProducir[m] - p.produccion.ventas[m], p.produccion.inventarioFinal[m])
    if (m) assert.equal(p.produccion.inventarioInicial[m], p.produccion.inventarioFinal[m - 1])
  }
})

test('presupuesto: excedente de materia prima evita compras y desembolsos ficticios', () => {
  const s = supuestosEjemplo()
  s.ventas.unidades = Array(12).fill(100)
  s.ventas.unidadesEneroSiguiente = 100
  s.inventarioProducto = { inicialUnidades: 0, porcentajeFinal: 0 }
  s.materiaPrima = { unidadesPorProducto: 2, costoUnitario: 1, inicialUnidades: 1000, porcentajeFinal: 0 }
  s.pagosCompras = { contado: 100, a30: 0, a60: 0, comprasNovAnterior: 0, comprasDicAnterior: 0 }
  const p = calcularPresupuesto(s)
  assert.deepEqual(p.materiaPrima.inventarioFinal.slice(0, 5), [800, 600, 400, 200, 0])
  assert.deepEqual(p.materiaPrima.aComprar.slice(0, 6), [0, 0, 0, 0, 0, 200])
  assert.deepEqual(p.caja.totalPagoCompras.slice(0, 6), [0, 0, 0, 0, 0, 200])
  for (let m = 0; m < 12; m++) cerca(p.materiaPrima.inventarioInicial[m] + p.materiaPrima.aComprar[m] - p.materiaPrima.necesidad[m], p.materiaPrima.inventarioFinal[m])
})

test('presupuesto: conserva sobrantes durante meses sin demanda y respeta el objetivo al agotarlos', () => {
  const s = supuestosEjemplo()
  s.ventas.unidades = [0, 0, 100, ...Array(9).fill(100)]
  s.inventarioProducto = { inicialUnidades: 150, porcentajeFinal: 20 }
  const p = calcularPresupuesto(s)
  assert.deepEqual(p.produccion.inventarioFinal.slice(0, 4), [150, 150, 50, 20])
  assert.deepEqual(p.produccion.aProducir.slice(0, 4), [0, 0, 0, 70])
})

test('TIR: detecta raíz doble, varias raíces, límites y ausencia de solución', () => {
  for (const escala of [1e-8, 1, 1e8]) cerca(tir([-100, 220, -121].map(v => v * escala)).valor, 10, 0.0001)
  assert.equal(tir([-100, 220, -121]).aviso, null)
  const dos = tir([-100, 230, -132])
  cerca(dos.valor, 10, 0.0001)
  assert.match(dos.aviso, /2 TIR/)
  cerca(tir([-100, 1]).valor, -99)
  cerca(tir([-100, 1100]).valor, 1000)
  assert.equal(tir([-100, 220, -121.01]).valor, null)
  assert.equal(tir([-100, 1200]).valor, null)
  assert.equal(tir([0, 0, 0]).valor, null)
  const f = [-1000, 500, 400, 300, 100]
  cerca(tir(f).valor, 14.4888, 0.0001)
  cerca(van(f, tir(f).valor), 0, 0.001)
})

test('B/C: incluye inversión y costos futuros sin alterar VAN ni recuperación', () => {
  const proyecto = { nombre: 'Bruto', inversionInicial: 1000, capitalTrabajo: 0, vidaUtil: 1, valorRescate: 0, ingresos: [3000], costos: [1000], depreciacion: [0] }
  const resultado = evaluarProyecto(proyecto, { tmar: 0, impuesto: 0, proyectos: [proyecto] })
  assert.equal(resultado.bc, 1.5)
  assert.equal(resultado.van, 1000)
  assert.equal(resultado.paybackSimple, 0.5)
  assert.deepEqual(resultado.flujos.flujoNeto, [-1000, 2000])
  const impuesto = flujosProyecto({ ...proyecto, capitalTrabajo: 200, valorRescate: 100, depreciacion: [500] }, 30)
  assert.deepEqual(impuesto.entradasEfectivo, [0, 3300])
  assert.deepEqual(impuesto.salidasEfectivo, [1200, 1450])
  for (let t = 0; t < 2; t++) cerca(impuesto.entradasEfectivo[t] - impuesto.salidasEfectivo[t], impuesto.flujoNeto[t])
})

test('equilibrio: los importes del gráfico corresponden a las mismas unidades mostradas', () => {
  const e = calcularPuntoEquilibrio(100, 13, 4)
  assert.equal(e.unidadesEquilibrio, 11.11)
  assert.equal(e.ventasEquilibrio, 144.44)
  for (const punto of e.datosGrafico) {
    cerca(punto.ventasTotales, punto.unidades * 13, 0.0051)
    cerca(punto.costosTotales, 100 + punto.unidades * 4, 0.0051)
  }
})
