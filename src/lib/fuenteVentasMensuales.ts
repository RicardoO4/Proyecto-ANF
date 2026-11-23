/** Selección temporal del escenario académico; no modifica ventas de inventarios. */
export function seleccionarVentasMensuales<T extends { observacion?: string | null }>(ventas: T[]) {
  const escenario = ventas.filter(v => v.observacion?.startsWith('Escenario simulado mensual '))
  const detalle = ventas.filter(v =>
    !v.observacion?.startsWith('Generado desde estados financieros ') &&
    !/^INV \d{4} INV-/.test(v.observacion ?? ''),
  )
  return { ventas: escenario.length ? escenario : detalle, escenarioSimulado: escenario.length > 0 }
}

/** Misma serie para el gráfico, las fórmulas y la explicación de IA. */
export function agruparVentasMensuales(ventas: { fecha_venta: string; monto_venta: number; observacion?: string | null }[]) {
  const seleccion = seleccionarVentasMensuales(ventas)
  const meses = new Map<string, number>()
  for (const venta of seleccion.ventas) {
    const mes = venta.fecha_venta.slice(0, 7)
    meses.set(mes, (meses.get(mes) ?? 0) + Number(venta.monto_venta))
  }
  const historico = [...meses].sort(([a], [b]) => a.localeCompare(b)).map(([periodo, monto]) => ({ periodo, monto }))
  return { historico, escenarioSimulado: seleccion.escenarioSimulado }
}
