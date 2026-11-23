// ================================================================
// Aceptación de las fórmulas del presupuesto maestro (Módulo E, E1-E2).
//
// Importa `src/lib/presupuesto.ts`, el MISMO código que usa la pantalla.
// Los valores esperados de enero a marzo están resueltos a mano con un
// ejemplo de números redondos (ver comentarios de cada bloque).
//
// Uso:  node --no-warnings scripts/verify-presupuesto.mts
// Sale con código 1 si alguna comprobación falla.
// ================================================================
import {
  calcularPresupuesto,
  crecimientoPromedio,
  proponerUnidades,
  supuestosEjemplo,
  validarSupuestos,
  type SupuestosPresupuesto,
} from '../src/lib/presupuesto.ts'

let fallos = 0
let total = 0

function check(nombre: string, obtenido: number, esperado: number, tolerancia = 0.005) {
  total++
  const ok = Math.abs(obtenido - esperado) <= tolerancia
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nombre.padEnd(52)} ${String(obtenido).padStart(12)}  (esperado ${esperado})`)
  if (!ok) fallos++
}

function checkMeses(nombre: string, obtenido: number[], esperados: number[]) {
  esperados.forEach((e, m) => check(`${nombre} ${['ene', 'feb', 'mar'].at(m)}`, obtenido.at(m) ?? NaN, e))
}

// ---------------------------------------------------------------
// Ejemplo: ventas de 100, 200, 300... unidades a $10
// ---------------------------------------------------------------
const s: SupuestosPresupuesto = {
  anio: 2026,
  ventas: {
    unidades: Array.from({ length: 12 }, (_, m) => 100 * (m + 1)),
    unidadesEneroSiguiente: 1300,
    precioUnitario: 10,
    ventasNovAnterior: 800,
    ventasDicAnterior: 900,
  },
  inventarioProducto: { inicialUnidades: 30, porcentajeFinal: 20 },
  materiaPrima: { unidadesPorProducto: 2, costoUnitario: 1.5, inicialUnidades: 50, porcentajeFinal: 10 },
  manoObra: { horasPorUnidad: 0.5, tarifaHora: 8 },
  cif: { tasaVariablePorHora: 2, fijosMensuales: 500, depreciacionMensual: 100 },
  gastosOperacion: { fijosMensuales: 300, porcentajeVariable: 5 },
  cobros: { contado: 50, a30: 30, a60: 20, incobrable: 0 },
  pagosCompras: { contado: 40, a30: 60, a60: 0, comprasNovAnterior: 100, comprasDicAnterior: 200 },
  otrosDesembolsos: [{ concepto: 'Impuestos', montos: [0, 1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }],
  caja: { efectivoInicial: 1000, saldoMinimo: 500 },
}

console.log('\n== 0. Validación ==')
check('supuestos válidos (0 errores)', validarSupuestos(s).length, 0)
check(
  'cobros que no suman 100 dan error',
  validarSupuestos({ ...s, cobros: { ...s.cobros, contado: 60 } }).length,
  1,
)
check('el ejemplo de la pantalla es válido', validarSupuestos(supuestosEjemplo(2026)).length, 0)

const p = calcularPresupuesto(s)

console.log('\n== 1. Ventas: unidades × $10 ==')
checkMeses('importe', p.ventas.importe, [1000, 2000, 3000])

console.log('\n== 2. Producción: ventas + 20% ventas del mes siguiente − inventario inicial ==')
// ene: 100 + 0.2×200 − 30 = 110 · feb: 200 + 60 − 40 = 220 · mar: 300 + 80 − 60 = 320
checkMeses('inventario final', p.produccion.inventarioFinal, [40, 60, 80])
checkMeses('a producir', p.produccion.aProducir, [110, 220, 320])

console.log('\n== 3. Materia prima: 2 por unidad, 10% de la necesidad siguiente, $1.50 ==')
// necesidad 220, 440, 640 (abr: 420 × 2 = 840) · final 44, 64, 84
// compras unidades: 220+44−50 = 214 · 440+64−44 = 460 · 640+84−64 = 660
checkMeses('necesidad', p.materiaPrima.necesidad, [220, 440, 640])
checkMeses('a comprar (unidades)', p.materiaPrima.aComprar, [214, 460, 660])
checkMeses('compras ($)', p.materiaPrima.compras, [321, 690, 990])

console.log('\n== 4. MOD: 0.5 h × $8 ==')
checkMeses('horas', p.manoObra.horas, [55, 110, 160])
checkMeses('costo MOD', p.manoObra.costo, [440, 880, 1280])

console.log('\n== 5. CIF: $2 por hora + $500 fijos, de ellos $100 depreciación ==')
checkMeses('CIF total', p.cif.total, [610, 720, 820])
checkMeses('CIF en efectivo', p.cif.efectivo, [510, 620, 720])

console.log('\n== 6. Gastos de operación: $300 + 5% de ventas ==')
checkMeses('gastos', p.gastosOperacion.total, [350, 400, 450])

console.log('\n== 7. Caja: cobros 50/30/20, pagos 40/60 ==')
// entradas ene: 500 + 0.3×900 + 0.2×800 = 930 · feb: 1000 + 300 + 180 = 1480 · mar: 1500 + 600 + 200 = 2300
checkMeses('total entradas', p.caja.totalEntradas, [930, 1480, 2300])
// pagos ene: 0.4×321 + 0.6×200 = 248.4 · feb: 276 + 192.6 = 468.6 · mar: 396 + 414 = 810
checkMeses('pago de compras', p.caja.totalPagoCompras, [248.4, 468.6, 810])
// desembolsos ene: 248.4+440+510+350 = 1548.4 · feb: 468.6+880+620+400+1000 = 3368.6 · mar: 810+1280+720+450 = 3260
checkMeses('total desembolsos', p.caja.totalDesembolsos, [1548.4, 3368.6, 3260])
checkMeses('flujo neto', p.caja.flujoNeto, [-618.4, -1888.6, -960])
// efectivo final: 1000 − 618.4 = 381.6 · 381.6 − 1888.6 = −1507 · −1507 − 960 = −2467
checkMeses('efectivo final', p.caja.efectivoFinal, [381.6, -1507, -2467])
checkMeses('financiamiento requerido (mín. 500)', p.caja.financiamientoRequerido, [118.4, 2007, 2967])
checkMeses('saldo excedente', p.caja.saldoExcedente, [0, 0, 0])

console.log('\n== 8. Propuesta de ventas ==')
// Inv ABC: 1,548,023.87 (2023) → 1,749,164.35 (2025): (1.12993)^(1/2) − 1 = 6.30 %
check(
  'crecimiento anual Inv ABC',
  crecimientoPromedio([
    { anio: 2023, monto: 1_548_023.87 },
    { anio: 2024, monto: 1_636_059.68 },
    { anio: 2025, monto: 1_749_164.35 },
  ]),
  6.3,
)
const iguales = Array.from({ length: 12 }, () => 100 / 12)
check('1,200 al año a $10 en partes iguales = 10 por mes', proponerUnidades(1200, 10, iguales).at(0) ?? NaN, 10)

console.log(`\n${total - fallos} de ${total} comprobaciones correctas.`)
if (fallos > 0) process.exit(1)
