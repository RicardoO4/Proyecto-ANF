// ================================================================
// Aceptación de las fórmulas del Módulo C.
//
// Importa `src/lib/ratioFormulas.ts`, es decir, el MISMO código que usan
// los endpoints. No hay copia paralela de las fórmulas.
//
// Fuentes de los valores esperados:
//   - Cátedra: "TAREA RATIOS.xlsx", hoja Balance2019-2020 (Empresa ABC).
//     Prueba ácida 2020 = 0.8034 y 2019 = 0.6093 resueltos a mano.
//   - Inv ABC: BALANCE_GENERAL real de la base (2023, 2024, 2025).
//
// Uso:  node scripts/verify-ratios.mts
// Sale con código 1 si alguna comprobación falla.
// ================================================================
import {
  endeudamientoPatrimonial,
  gradoEndeudamiento,
  gradoPropiedad,
  promedioSaldo,
  pruebaAcida,
} from '../src/lib/ratioFormulas.ts'

let fallos = 0
let total = 0

function check(nombre: string, obtenido: number, esperado: number, tolerancia = 0.00005) {
  total++
  const ok = Math.abs(obtenido - esperado) <= tolerancia
  const estado = ok ? 'PASS' : 'FAIL'
  console.log(`${estado}  ${nombre.padEnd(58)} ${String(obtenido).padStart(12)}  (esperado ${esperado})`)
  if (!ok) fallos++
}

// ---------------------------------------------------------------
// 1. Cátedra — Empresa ABC, Balance 2019/2020 (miles de USD)
// ---------------------------------------------------------------
console.log('\n== 1. Cátedra: TAREA RATIOS.xlsx (Empresa ABC) ==')
const ABC = {
  2020: { ac: 19_900_000, inv: 8_700_000, pc: 13_940_000, activo: 30_700_000, pasivo: 18_780_000 },
  2019: { ac: 18_850_000, inv: 9_400_000, pc: 15_510_000, activo: 30_030_000, pasivo: 18_510_000 },
}
for (const anio of [2020, 2019] as const) {
  const d = ABC[anio]
  check(`prueba ácida ${anio}`, pruebaAcida(d.ac, d.inv, d.pc), anio === 2020 ? 0.8034 : 0.6093)
}
check(
  'grado de endeudamiento 2020',
  gradoEndeudamiento(ABC[2020].pasivo, ABC[2020].activo),
  0.6117,
)
check(
  'grado de propiedad 2020',
  gradoPropiedad(ABC[2020].activo - ABC[2020].pasivo, ABC[2020].activo),
  0.3883,
)
check(
  'endeudamiento patrimonial 2020',
  endeudamientoPatrimonial(ABC[2020].pasivo, ABC[2020].activo - ABC[2020].pasivo),
  1.5755,
)

// ---------------------------------------------------------------
// 2. Inv ABC — BALANCE_GENERAL vivo (empresa 2)
// ---------------------------------------------------------------
console.log('\n== 2. Inv ABC: BALANCE_GENERAL de la base ==')
const INV = {
  2023: { ac: 1_840_754.72, inv: 497_022.92, pc: 5_114_546.8, activo: 5_297_318.03, pasivo: 5_149_834.74, patrimonio: 147_483.28 },
  2024: { ac: 2_189_988.01, inv: 662_697.23, pc: 5_732_704.98, activo: 5_632_723.49, pasivo: 5_768_301.76, patrimonio: -135_578.27 },
  2025: { ac: 2_522_343.08, inv: 762_101.81, pc: 6_141_504.57, activo: 5_951_250.73, pasivo: 6_177_410.19, patrimonio: -226_159.45 },
}
const ESPERADO_ACIDA = { 2023: 0.2627, 2024: 0.2664, 2025: 0.2866 } as const
const ESPERADO_ENDEUDAMIENTO = { 2023: 0.9722, 2024: 1.0241, 2025: 1.038 } as const
for (const anio of [2023, 2024, 2025] as const) {
  const d = INV[anio]
  check(`prueba ácida ${anio}`, pruebaAcida(d.ac, d.inv, d.pc), ESPERADO_ACIDA[anio])
  check(
    `grado de endeudamiento ${anio}`,
    gradoEndeudamiento(d.pasivo, d.activo),
    ESPERADO_ENDEUDAMIENTO[anio],
  )
  // Identidad contable: pasivo/activo + patrimonio/activo = 1
  const suma = gradoEndeudamiento(d.pasivo, d.activo) + gradoPropiedad(d.patrimonio, d.activo)
  check(`identidad endeudamiento + propiedad ${anio}`, suma, 1)
}
check(
  'endeudamiento patrimonial 2023 (patrimonio positivo)',
  endeudamientoPatrimonial(INV[2023].pasivo, INV[2023].patrimonio),
  34.9181,
)
check(
  'endeudamiento patrimonial 2024 (patrimonio negativo)',
  endeudamientoPatrimonial(INV[2024].pasivo, INV[2024].patrimonio),
  -42.5459,
)

// ---------------------------------------------------------------
// 3. Promedios: el año anterior ausente NO se promedia contra 0
// ---------------------------------------------------------------
console.log('\n== 3. Promedios y casos borde ==')
check('promedio sin año anterior (null)', promedioSaldo(100, null), 100)
check('promedio con año anterior', promedioSaldo(100, 300), 200)
check('promedio con saldo anterior realmente 0', promedioSaldo(100, 0), 50)

check('prueba ácida con pasivo corriente 0', pruebaAcida(100, 40, 0), 0)
check('endeudamiento con activo 0', gradoEndeudamiento(100, 0), 0)
check('propiedad con activo 0', gradoPropiedad(100, 0), 0)
check('endeudamiento patrimonial con patrimonio 0', endeudamientoPatrimonial(100, 0), 0)

console.log(`\n${fallos === 0 ? 'OK' : 'FALLÓ'}: ${total - fallos}/${total} comprobaciones`)
process.exit(fallos === 0 ? 0 : 1)
