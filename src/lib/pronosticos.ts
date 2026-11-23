import { BadRequestException } from '@/lib/errors'
import { proyeccionLogaritmica, proyeccionPromedioMovil } from '@/lib/proyeccion'
import type { VentaRow } from '@/types'
import { seleccionarVentasMensuales } from './fuenteVentasMensuales'

// El escenario académico constituye una serie independiente de las ventas
// registradas por otros módulos. Nunca se mezclan ambas fuentes al pronosticar.
function seleccionarHistorico(ventas: VentaRow[], periodicidad: 'anual' | 'mensual') {
  return periodicidad === 'mensual'
    ? seleccionarVentasMensuales(ventas)
    : { ventas, escenarioSimulado: false }
}

export function proyeccionCuadratica(ventas: number[], periodos: number): number[] {
  if (ventas.length < 3 || !ventas.every(Number.isFinite)) throw new BadRequestException('La regresión cuadrática requiere tres periodos válidos.')
  // Coordenadas centradas y normalizadas para evitar pérdida de precisión.
  const n = ventas.length, centro = (n + 1) / 2
  const x = ventas.map((_, i) => (i + 1 - centro) / n)
  const suma = (f: (v: number, i: number) => number) => x.reduce((s, v, i) => s + f(v, i), 0)
  const m = [
    [n, suma(v => v), suma(v => v * v), ventas.reduce((a, b) => a + b, 0)],
    [suma(v => v), suma(v => v * v), suma(v => v ** 3), suma((v, i) => v * ventas[i])],
    [suma(v => v * v), suma(v => v ** 3), suma(v => v ** 4), suma((v, i) => v * v * ventas[i])],
  ]
  for (let col = 0; col < 3; col++) {
    const pivot = [col, ...Array.from({ length: 2 - col }, (_, i) => col + 1 + i)].reduce((best, i) => Math.abs(m[i][col]) > Math.abs(m[best][col]) ? i : best, col)
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    const divisor = m[col][col]
    if (Math.abs(divisor) < 1e-12) throw new BadRequestException('No se puede ajustar la regresión cuadrática.')
    for (let j = col; j < 4; j++) m[col][j] /= divisor
    for (let i = 0; i < 3; i++) if (i !== col) {
      const factor = m[i][col]
      for (let j = col; j < 4; j++) m[i][j] -= factor * m[col][j]
    }
  }
  return Array.from({ length: periodos }, (_, i) => {
    const v = (n + i + 1 - centro) / n
    return Math.round(Math.max(0, m[0][3] + m[1][3] * v + m[2][3] * v * v) * 100) / 100
  })
}

export function prepararSerieVentas(ventas: VentaRow[], periodicidad: 'anual' | 'mensual') {
  ventas = seleccionarHistorico(ventas, periodicidad).ventas
  const periodos = new Map<string, number>()
  const anuales = ventas.filter(v => v.observacion?.startsWith('Generado desde estados financieros '))
  const detalle = ventas.filter(v => !v.observacion?.startsWith('Generado desde estados financieros '))
  // En anual se prefiere el total contable del año; no se suma otra vez su detalle.
  const aniosContables = new Set(anuales.map(v => v.fecha_venta.slice(0, 4)))
  const filas = periodicidad === 'anual' ? [...anuales, ...detalle.filter(v => !aniosContables.has(v.fecha_venta.slice(0, 4)))] : detalle
  for (const venta of filas) {
    const clave = venta.fecha_venta.slice(0, periodicidad === 'anual' ? 4 : 7)
    const monto = Number(venta.monto_venta)
    if (!Number.isFinite(monto)) throw new BadRequestException('Hay ventas con importes inválidos.')
    periodos.set(clave, (periodos.get(clave) ?? 0) + monto)
  }
  const historico = [...periodos].sort(([a], [b]) => a.localeCompare(b)).map(([periodo, monto]) => ({ periodo, monto }))
  if (historico.length < 3) throw new BadRequestException(`Se necesitan al menos tres periodos ${periodicidad === 'anual' ? 'anuales' : 'mensuales'} reales. Los totales anuales no son ventas mensuales.`)
  const indice = (p: string) => periodicidad === 'anual' ? Number(p) : Number(p.slice(0, 4)) * 12 + Number(p.slice(5)) - 1
  if (historico.some((f, i) => i > 0 && indice(f.periodo) - indice(historico[i - 1].periodo) !== 1)) throw new BadRequestException('El histórico tiene periodos faltantes. Complete los datos antes de pronosticar.')
  return historico
}

export function pronosticarVentas(ventas: VentaRow[], periodicidad: 'anual' | 'mensual', periodos: number) {
  if (!Number.isInteger(periodos) || periodos < 1 || periodos > 12) throw new BadRequestException('Seleccione entre 1 y 12 periodos.')
  const historico = prepararSerieVentas(ventas, periodicidad)
  const montos = historico.map(f => f.monto)
  const ultimo = historico.at(-1)!.periodo
  const movil = proyeccionPromedioMovil(montos, 3, periodos)
  const logaritmica = proyeccionLogaritmica(montos, periodos)
  const cuadratica = proyeccionCuadratica(montos, periodos)
  const proyecciones = Array.from({ length: periodos }, (_, i) => {
    const fecha = periodicidad === 'anual' ? String(Number(ultimo) + i + 1) : new Date(Date.UTC(Number(ultimo.slice(0, 4)), Number(ultimo.slice(5)) + i, 1)).toISOString().slice(0, 7)
    return { periodo: fecha, movil: Math.max(0, movil[i]), logaritmica: logaritmica[i], cuadratica: cuadratica[i] }
  })
  const { escenarioSimulado } = seleccionarHistorico(ventas, periodicidad)
  return { periodicidad, historico, proyecciones, escenarioSimulado }
}
export type PronosticoVentas = ReturnType<typeof pronosticarVentas>
