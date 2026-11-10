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

/** Cobertura de intereses = EBIT / Gastos Financieros. Mayor es mejor. */
export function coberturaIntereses(ebit: number, gastosFinancieros: number): number {
  return gastosFinancieros === 0 ? 0 : redondear(ebit / gastosFinancieros)
}

/** Margen neto = Utilidad Neta / Ventas Netas. Mayor es mejor. */
export function margenNeto(utilidadNeta: number, ventasNetas: number): number {
  return ventasNetas === 0 ? 0 : redondear(utilidadNeta / ventasNetas)
}

/** Rendimiento sobre Activos (ROA) = Utilidad Neta / Activo Total. Mayor es mejor. */
export function roa(utilidadNeta: number, activoTotal: number): number {
  return activoTotal === 0 ? 0 : redondear(utilidadNeta / activoTotal)
}

/** Rendimiento sobre Patrimonio (ROE) = Utilidad Neta / Patrimonio. Mayor es mejor. */
export function roe(utilidadNeta: number, patrimonio: number): number {
  return patrimonio === 0 ? 0 : redondear(utilidadNeta / patrimonio)
}

/** Rotación de Inventarios = Costo de Ventas / Inventario. Mayor es mejor. */
export function rotacionInventario(costoVentas: number, inventario: number): number {
  return inventario === 0 ? 0 : redondear(costoVentas / inventario)
}

/** Edad Promedio del Inventario (EPI) en días = (Inventario * 365) / Costo de Ventas. Menor es mejor. */
export function edadPromedioInventario(
  inventario: number,
  costoVentas: number,
  dias: number = DIAS_EJERCICIO,
): number {
  return costoVentas === 0 ? 0 : redondear((inventario * dias) / costoVentas, 2)
}

/** Período Medio de Pago (PPP) en días = (Cuentas por Pagar * 365) / Costo de Ventas. */
export function periodoMedioPago(
  cuentasPorPagar: number,
  costoVentas: number,
  dias: number = DIAS_EJERCICIO,
): number {
  return costoVentas === 0 ? 0 : redondear((cuentasPorPagar * dias) / costoVentas, 2)
}

/** Ciclo Operativo (CO) = EPI + PPC. Menor es mejor. */
export function cicloOperativo(epi: number, ppc: number): number {
  return redondear(epi + ppc, 2)
}

/** Ciclo de Conversión de Efectivo (CCE) = Ciclo Operativo − PPP. Menor es mejor. */
export function cicloConversionEfectivo(cicloOperativoVal: number, ppp: number): number {
  return redondear(cicloOperativoVal - ppp, 2)
}

/** Análisis DuPont: ROE desglosado = Margen Neto * Rotación Activos * Multiplicador Capital. */
export function analisisDuPont(
  margenNetoVal: number,
  rotacionActivos: number,
  multiplicadorCapital: number,
): number {
  return redondear(margenNetoVal * rotacionActivos * multiplicadorCapital)
}
