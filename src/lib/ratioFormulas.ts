// ================================================================
// Fórmulas puras de ratios — Módulo C.
//
// Este módulo NO importa Supabase ni hace I/O: recibe saldos ya
// sumados y devuelve un número. Lo usan dos consumidores:
//   1. los calculadores HTTP de `lib/ratios.ts` (producción);
//   2. `scripts/verify-ratios.mts` (aceptación contra la cátedra).
// Al compartir el código, lo que se prueba es exactamente lo que
// corre en la aplicación, no una copia paralela.
//
// Las reglas de dirección ("mayor/menor es mejor") no viven acá: cada
// calculador las aplica al comparar contra el benchmark del sector.
// ================================================================

/** Decimales de trabajo. La BD guarda NUMERIC(15,2) hasta que corra 003. */
export const ESCALA = 4

/** Días usados por la cátedra para anualizar rotaciones. */
export const DIAS_EJERCICIO = 365

export function redondear(valor: number, escala: number = ESCALA): number {
  const factor = Math.pow(10, escala)
  return Math.round(valor * factor) / factor
}

/**
 * Promedio de dos saldos cuando el año anterior existe.
 * `anterior === null` significa "no hay estado financiero del año previo":
 * en ese caso se usa el saldo actual. Promediar contra 0 reduce el
 * denominador a la mitad y duplica el ratio en silencio (bug que corrige
 * el Módulo C).
 */
export function promedioSaldo(actual: number, anterior: number | null): number {
  return anterior === null ? actual : (actual + anterior) / 2
}

/** Razón de circulante o liquidez corriente = activo cte / pasivo cte. */
export function liquidezCorriente(activoCorriente: number, pasivoCorriente: number): number {
  return pasivoCorriente === 0 ? 0 : redondear(activoCorriente / pasivoCorriente)
}

/** Prueba ácida = (activo corriente − inventario) / pasivo corriente. */
export function pruebaAcida(
  activoCorriente: number,
  inventario: number,
  pasivoCorriente: number,
): number {
  return pasivoCorriente === 0
    ? 0
    : redondear((activoCorriente - inventario) / pasivoCorriente)
}

/** Grado de endeudamiento = pasivo total / activo total. Menor es mejor. */
export function gradoEndeudamiento(pasivoTotal: number, activoTotal: number): number {
  return activoTotal === 0 ? 0 : redondear(pasivoTotal / activoTotal)
}

/** Grado de propiedad = patrimonio / activo total. Mayor es mejor. */
export function gradoPropiedad(patrimonio: number, activoTotal: number): number {
  return activoTotal === 0 ? 0 : redondear(patrimonio / activoTotal)
}

/**
 * Razón de endeudamiento patrimonial = pasivo total / patrimonio.
 * Menor es mejor. Con patrimonio ≤ 0 el resultado es matemáticamente
 * válido pero económicamente ininterpretable: el calculador lo marca
 * como incumplido y lo explica en la interpretación.
 */
export function endeudamientoPatrimonial(pasivoTotal: number, patrimonio: number): number {
  return patrimonio === 0 ? 0 : redondear(pasivoTotal / patrimonio)
}
