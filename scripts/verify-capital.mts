// ================================================================
// Aceptación de las fórmulas del presupuesto de capital (Módulo E, E3).
//
// Importa `src/lib/capital.ts`, el MISMO código que usa la pantalla.
//
// Caso 1 (libro): inversión $1,000; flujos 500, 400, 300, 100; tasa 10 %.
//   VP = 454.545 + 330.579 + 225.394 + 68.301 = 1,078.82 → VAN = 78.82
//   TIR ≈ 14.4888 %   B/C = 1,078.82 / 1,000 = 1.0788
//   Payback simple = 2 + 100/300 = 2.33 años
//   Payback descontado: acumulado −545.45, −214.88, +10.52 → 2 + 214.88/225.39 = 2.95
//
// Caso 2 (detallado con ISR 30 %): inversión 10,000, capital de trabajo
//   2,000, 3 años, rescate 1,000, ingresos 8,000 y costos 3,000 por año.
//   Depreciación = (10,000 − 1,000)/3 = 3,000; UAI = 2,000; ISR = 600;
//   flujo operativo = 1,400 + 3,000 = 4,400; año 3 + 1,000 + 2,000 = 7,400.
//   Flujos: −12,000; 4,400; 4,400; 7,400.
//
// Uso:  node --no-warnings scripts/verify-capital.mts
// ================================================================
import {
  capitalEjemplo,
  compararProyectos,
  depreciacionLineal,
  flujosProyecto,
  paybackDescontado,
  paybackSimple,
  relacionBC,
  tir,
  validarCapital,
  van,
} from '../src/lib/capital.ts'

let fallos = 0
let total = 0

function check(nombre: string, obtenido: number | null, esperado: number | null, tolerancia = 0.01) {
  total++
  const ok =
    obtenido === null || esperado === null ? obtenido === esperado : Math.abs(obtenido - esperado) <= tolerancia
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nombre.padEnd(48)} ${String(obtenido).padStart(12)}  (esperado ${esperado})`)
  if (!ok) fallos++
}

console.log('\n== 1. Caso de libro: −1000, 500, 400, 300, 100 al 10 % ==')
const f1 = [-1000, 500, 400, 300, 100]
check('VAN', Math.round(van(f1, 10) * 100) / 100, 78.82)
check('TIR (%)', tir(f1).valor, 14.4888, 0.001)
check('B/C', relacionBC(f1, 10), 1.0788, 0.0001)
check('payback simple (años)', paybackSimple(f1), 2.33)
check('payback descontado (años)', paybackDescontado(f1, 10), 2.95)
check('VAN a la TIR ≈ 0', Math.round(van(f1, tir(f1).valor ?? 0) * 100) / 100, 0)

console.log('\n== 2. Casos especiales ==')
check('TIR sin cambio de signo = null', tir([100, 200]).valor, null)
check('payback que nunca se recupera = null', paybackSimple([-1000, 100, 100]), null)
const multiple = tir([-100, 230, -132])
check('flujos −100, 230, −132 tienen 2 TIR (aviso)', multiple.aviso ? 2 : 0, 2)

console.log('\n== 3. Caso detallado con ISR 30 % ==')
check('depreciación lineal', depreciacionLineal(10_000, 1_000, 3).at(0) ?? NaN, 3000)
const p2 = {
  nombre: 'Detallado',
  inversionInicial: 10_000,
  capitalTrabajo: 2_000,
  vidaUtil: 3,
  valorRescate: 1_000,
  ingresos: [8_000, 8_000, 8_000],
  costos: [3_000, 3_000, 3_000],
  depreciacion: depreciacionLineal(10_000, 1_000, 3),
}
const fl = flujosProyecto(p2, 30)
check('UAI año 1', fl.utilidadAntesImpuestos.at(0) ?? NaN, 2000)
check('ISR año 1', fl.impuesto.at(0) ?? NaN, 600)
check('flujo operativo año 1', fl.flujoOperativo.at(0) ?? NaN, 4400)
check('flujo neto año 0', fl.flujoNeto.at(0) ?? NaN, -12000)
check('flujo neto año 3 (con rescate y capital)', fl.flujoNeto.at(3) ?? NaN, 7400)
// VAN al 12 %: 4400/1.12 + 4400/1.2544 + 7400/1.404928 − 12000 = 3928.57 + 3507.65 + 5267.18 − 12000 = 703.40
check('VAN al 12 %', Math.round(van(fl.flujoNeto, 12) * 100) / 100, 703.4)
const sinUtilidad = flujosProyecto({ ...p2, ingresos: [1_000, 1_000, 1_000] }, 30)
check('pérdida → ISR 0', sinUtilidad.impuesto.at(0) ?? NaN, 0)

console.log('\n== 4. Ejemplo de la pantalla ==')
const ej = capitalEjemplo()
check('ejemplo válido (0 errores)', validarCapital(ej).length, 0)
const comp = compararProyectos(ej)
check('evalúa 2 proyectos', comp.evaluaciones.length, 2)

console.log(`\n${total - fallos} de ${total} comprobaciones correctas.`)
if (fallos > 0) process.exit(1)
