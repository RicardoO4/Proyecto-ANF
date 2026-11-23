// Deterministic regression tests. No network, credentials, or production writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { analizarInventarios, validarProducto } from '../src/lib/inventarios.ts'
import { utilidadEjercicio, saldoPromedio, descomponerDupont } from '../src/lib/rentabilidad.ts'
import { proyeccionCuadratica, prepararSerieVentas, pronosticarVentas } from '../src/lib/pronosticos.ts'
import { calcularProyeccion } from '../src/lib/proyeccion.ts'
import { generarProforma } from '../src/lib/proforma.ts'
import { calcularPuntoEquilibrio } from '../src/lib/equilibrio.ts'
import { puedeVerPagina, opcionDePagina } from '../src/lib/accesos.ts'

const anual = (anio, monto) => ({ id_venta: anio, empresa_id: 1, fecha_venta: `${anio}-12-31`, monto_venta: monto, observacion: `Generado desde estados financieros ${anio}` })
const ventasAnuales = [anual(2023, 1000), anual(2024, 2000), anual(2025, 3000)]
const mensual = Array.from({ length: 12 }, (_, i) => ({ id_venta: i + 1, empresa_id: 1, fecha_venta: `2025-${String(i + 1).padStart(2, '0')}-01`, monto_venta: 100, observacion: null }))
test('B-C: un ER con ingresos cero conserva los gastos; solo se usa fallback sin ER', () => {
  assert.equal(utilidadEjercicio(true, 0, 200, 999), -200)
  assert.equal(utilidadEjercicio(false, 0, 0, -300), -300)
  assert.equal(saldoPromedio(100, null), 100)
  assert.equal(saldoPromedio(100, 0), 50)
})
test('DuPont comparte los denominadores promedios y evita patrimonio no positivo', () => {
  const d = descomponerDupont(1000, 200, 800, 400)
  assert.equal(d.roe, 0.5)
  assert.equal(d.margen * d.rotacion * d.multiplicador, 0.5)
  assert.equal(descomponerDupont(1000, -200, 800, -400).roe, null)
})
test('D1: regresión cuadrática reproduce un polinomio conocido', () => {
  assert.deepEqual(proyeccionCuadratica([6, 11, 18, 27], 2), [38, 51])
  assert.throws(() => proyeccionCuadratica([1, 2], 1))
})
test('A-D: nunca convertir totales anuales en meses ni duplicarlos con su detalle', () => {
  assert.throws(() => calcularProyeccion(1, ventasAnuales, 12, 'MINIMOS_CUADRADOS'))
  assert.throws(() => prepararSerieVentas(ventasAnuales, 'mensual'))
  assert.equal(prepararSerieVentas([...ventasAnuales, ...mensual], 'anual').at(-1).monto, 3000)
  assert.equal(pronosticarVentas(ventasAnuales, 'anual', 2).proyecciones[0].periodo, '2026')
})
test('D1: proyecciones mensuales requieren datos consecutivos reales', () => {
  assert.throws(() => calcularProyeccion(1, mensual.slice(1), 12, 'MINIMOS_CUADRADOS'))
  assert.throws(() => prepararSerieVentas([mensual[0], mensual[2], mensual[3]], 'mensual'))
  for (const metodo of ['MINIMOS_CUADRADOS', 'INCREMENTO_ABSOLUTO', 'INCREMENTO_PORCENTUAL']) {
    const p = calcularProyeccion(1, mensual, 12, metodo)
    assert.equal(p[0].montoProyectado, 100)
    assert.equal(p[0].fechaProyectada, '2026-01-31')
  }
})
const producto = (codigo, demanda, costo = 1) => ({ codigo, nombre: codigo, demanda_anual: demanda, costo_unitario: costo, costo_pedido: 10, costo_mantenimiento_anual: 2, plazo_entrega_dias: 5, stock_seguridad: 10, dias_operacion: 250, existencias: 0 })
test('C4: ABC, EOQ y reorden usan consumo, demanda y unidades correctas', () => {
  const p = analizarInventarios([producto('A', 800), producto('B', 150), producto('C', 50)])
  assert.deepEqual(p.map(f => f.clase), ['A', 'B', 'C'])
  assert.equal(p[2].acumulado, 100)
  assert.equal(p[0].eoq, Math.sqrt(8000))
  assert.equal(p[0].puntoReorden, 26)
  assert.equal(p[0].pedir, true)
  assert.equal(analizarInventarios([producto('cero', 0)])[0].clase, 'C')
  assert.ok(validarProducto({ ...producto('mal', 100), costo_mantenimiento_anual: 0 }).length)
})
const linea = (codigo, saldo) => ({ codigo, nombre: codigo, saldo })
const base = { empresaId: 1, anio: 2025, anios: [2025], tieneBalance: true, tieneResultados: true, ventas: 1000, activos: 1000, pasivos: 500, patrimonio: 500,
  balance: [linea('1101', 100), linea('1105', 600), linea('1201', 300), linea('2102', 200), linea('2201', 300), linea('3101', 500)], resultados: [linea('5101.01', 1000), linea('4101', 600), linea('4102', 200)] }
test('D5: ER completo separa costos; balance cuadra después de FER y exceso de caja', () => {
  const p = generarProforma(base, { ventasProyectadas: 1200, retencion: 50, porcentajeVariableGastos: 0 })
  assert.equal(p.utilidad, 280)
  assert.equal(p.retenida, 140)
  assert.equal(p.fer, -60)
  assert.equal(p.excesoCaja, 60)
  assert.equal(p.diferencia, 0)
  assert.equal(p.resultados.find(f => f.codigo === '4102').proyectado, 200)
  const deuda = generarProforma(base, { ventasProyectadas: 3000, retencion: 0, porcentajeVariableGastos: 100 })
  assert.ok(deuda.financiamiento > 0)
  assert.equal(deuda.diferencia, 0)
  assert.throws(() => generarProforma({ ...base, patrimonio: 1 }, { ventasProyectadas: 1200, retencion: 50, porcentajeVariableGastos: 0 }))
})
test('D5: las pérdidas reducen completamente el patrimonio, sin aplicar retención', () => {
  const p = generarProforma(base, { ventasProyectadas: 100, retencion: 0, porcentajeVariableGastos: 0 })
  assert.ok(p.utilidad < 0)
  assert.equal(p.retenida, p.utilidad)
  assert.equal(p.diferencia, 0)
})
test('D4: cero costos fijos no produce bucles; entradas inválidas no calculan', () => {
  assert.equal(calcularPuntoEquilibrio(0, 10, 5).datosGrafico.length, 11)
  assert.equal(calcularPuntoEquilibrio(-1, 10, 5), null)
  assert.equal(calcularPuntoEquilibrio(100, 5, 5), null)
})
test('A8: rutas directas, inventarios y accesos respetan el módulo', () => {
  assert.equal(opcionDePagina('/inventarios'), 3)
  assert.equal(puedeVerPagina('/proyecciones/capital', { rol: 'ANALISTA', accesos: [3] }), false)
  assert.equal(puedeVerPagina('/inventarios', { rol: 'ANALISTA', accesos: [3] }), true)
  assert.equal(puedeVerPagina('/usuarios', { rol: 'ADMIN', accesos: [] }), true)
})
