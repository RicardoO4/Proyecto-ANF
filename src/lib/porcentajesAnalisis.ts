/** Por convención de presentación, 0 sobre base 0 se muestra como 0 %.
 * Un importe distinto de cero sobre base 0 sigue siendo no calculable. */
export function porcentajeAnalisis(valor: number, base: number): number | null {
  return base === 0 ? (valor === 0 ? 0 : null) : (valor / base) * 100
}

export function formatearPorcentajeAnalisis(valor: number | null): string {
  return valor === null ? 'No calculable: base cero' : `${valor.toFixed(2)}%`
}
