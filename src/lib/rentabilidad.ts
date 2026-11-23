/** Un solo criterio para B, C y los simuladores: ER presente, incluso con ingresos cero. */
export function utilidadEjercicio(tieneResultados: boolean, ingresos: number, gastos: number, resultadoBalance: number): number {
  return tieneResultados ? ingresos - gastos : resultadoBalance
}

export function saldoPromedio(actual: number, anterior: number | null): number {
  return anterior === null ? actual : (actual + anterior) / 2
}

export function descomponerDupont(ventas: number, utilidad: number, activos: number, patrimonio: number) {
  const margen = ventas > 0 ? utilidad / ventas : null
  const rotacion = activos > 0 ? ventas / activos : null
  const multiplicador = patrimonio > 0 && activos > 0 ? activos / patrimonio : null
  return { margen, rotacion, multiplicador, roe: patrimonio > 0 ? utilidad / patrimonio : null }
}

export function calcularGraficoSensibilidadDupont(roeBase: number, margenCambio = 0, rotacionCambio = 0, capitalCambio = 0) {
  return Array.from({ length: 9 }, (_, i) => {
    const cambio = -20 + i * 5
    const roePorcentaje = roeBase * 100
    const m = 1 + margenCambio / 100, r = 1 + rotacionCambio / 100, k = 1 + capitalCambio / 100
    const redondear = (valor: number) => Number(valor.toFixed(4))
    return {
      cambio,
      combinado: redondear(roePorcentaje * m * r * k),
      margen: redondear(roePorcentaje * (m + cambio / 100) * r * k),
      rotacion: redondear(roePorcentaje * m * (r + cambio / 100) * k),
      capital: redondear(roePorcentaje * m * r * (k + cambio / 100)),
    }
  })
}
