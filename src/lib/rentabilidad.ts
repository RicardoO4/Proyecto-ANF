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

export function calcularGraficoSensibilidadDupont(roeBase: number) {
  return Array.from({ length: 9 }, (_, i) => {
    const cambio = -20 + i * 5
    const roePorcentaje = roeBase * 100
    const roeSimulado = roePorcentaje * (1 + cambio / 100)
    return {
      cambio,
      margen: Number(roeSimulado.toFixed(4)),
      rotacion: Number(roeSimulado.toFixed(4)),
      capital: Number(roeSimulado.toFixed(4)),
    }
  })
}