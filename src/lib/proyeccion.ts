// Projection math — faithful port of ProyeccionService.calcularProyeccion.
import { BadRequestException, NotFoundException } from '@/lib/errors'
import type { MetodoProyeccion, ProyeccionDTO, VentaRow } from '@/types'

function round(value: number, scale: number): number {
  const factor = Math.pow(10, scale)
  return Math.round(value * factor) / factor
}

function endOfMonth(year: number, month1Based: number): Date {
  // last day of the month, in UTC to keep the calendar stable
  return new Date(Date.UTC(year, month1Based, 0))
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addMonthsLastDay(base: { year: number; month: number }, months: number): Date {
  // months is 1-based; advance `k` months keeping the last day
  const total = (base.month - 1) + months
  return endOfMonth(base.year + Math.floor(total / 12), (total % 12) + 1)
}

/**
 * @param ventas historical ventas rows (any order)
 * @param mesesFuturos number of future months to project
 */
export function calcularProyeccion(
  empresaId: number,
  ventas: VentaRow[],
  mesesFuturos: number,
  metodo: MetodoProyeccion,
): ProyeccionDTO[] {
  if (!ventas.length) {
    throw new NotFoundException(
      'No hay ventas históricas registradas para esta empresa.',
    )
  }

  const sorted = [...ventas].sort(
    (a, b) => new Date(a.fecha_venta).getTime() - new Date(b.fecha_venta).getTime(),
  )
  const first = new Date(sorted[0].fecha_venta)
  const last = new Date(sorted[sorted.length - 1].fecha_venta)

  // month span (inclusive) must be >= 11
  const span =
    (last.getUTCFullYear() - first.getUTCFullYear()) * 12 +
    (last.getUTCMonth() - first.getUTCMonth()) +
    1
  if (span < 11) {
    throw new BadRequestException(
      'Se necesitan al menos 11 meses de datos históricos para proyectar.',
    )
  }

  // group by YYYY-MM (sum duplicates), sorted ascending
  const byMonth = new Map<string, number>()
  for (const v of sorted) {
    const d = new Date(v.fecha_venta)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(v.monto_venta))
  }
  let montos = [...byMonth.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([, monto]) => monto)

  // keep only the last 12 months of data
  if (montos.length > 12) {
    montos = montos.slice(montos.length - 12)
  }

  // with exactly 11 months, synthesize a 12th data point:
  // last + average of the consecutive absolute differences
  if (montos.length === 11) {
    const diffs: number[] = []
    for (let i = 1; i < montos.length; i++) diffs.push(montos[i] - montos[i - 1])
    const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length
    montos = [...montos, round(montos[montos.length - 1] + avg, 2)]
  }

  const lastKey = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))[
    byMonth.size - 1
  ][0]
  const [lastYear, lastMonth] = lastKey.split('-').map(Number)
  const base = { year: lastYear, month: lastMonth }

  const resultados: ProyeccionDTO[] = []

  if (metodo === 'MINIMOS_CUADRADOS') {
    const n = montos.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
    for (let i = 0; i < n; i++) {
      const x = i + 1
      const y = montos[i]
      sumX += x
      sumY += y
      sumXY += x * y
      sumX2 += x * x
    }
    const denom = n * sumX2 - sumX * sumX
    // Java would throw ArithmeticException → 500 on a zero divisor; keep the same behavior
    if (denom === 0) throw new BadRequestException('Error al calcular la proyección.')
    const b = (n * sumXY - sumX * sumY) / denom
    const a = (sumY - b * sumX) / n
    for (let i = 1; i <= mesesFuturos; i++) {
      const x = n + i
      const y = a + b * x
      const fecha = addMonthsLastDay(base, i)
      resultados.push({ fechaProyectada: isoDate(fecha), montoProyectado: y })
    }
  } else if (metodo === 'INCREMENTO_PORCENTUAL') {
    const tasas: number[] = []
    for (let i = 1; i < montos.length; i++) {
      if (montos[i - 1] === 0) {
        // Java: ArithmeticException → 500
        throw new BadRequestException('Error al calcular la proyección.')
      }
      tasas.push((montos[i] - montos[i - 1]) / montos[i - 1])
    }
    const rProm = round(tasas.reduce((s, t) => s + t, 0) / tasas.length, 6)
    let montoBase = montos[montos.length - 1]
    for (let i = 1; i <= mesesFuturos; i++) {
      montoBase = montoBase * (1 + rProm)
      const fecha = addMonthsLastDay(base, i)
      resultados.push({ fechaProyectada: isoDate(fecha), montoProyectado: montoBase })
    }
  } else {
    // INCREMENTO_ABSOLUTO
    const deltas: number[] = []
    for (let i = 1; i < montos.length; i++) deltas.push(montos[i] - montos[i - 1])
    const dProm = round(deltas.reduce((s, d) => s + d, 0) / deltas.length, 2)
    let montoBase = montos[montos.length - 1]
    for (let i = 1; i <= mesesFuturos; i++) {
      montoBase = montoBase + dProm
      const fecha = addMonthsLastDay(base, i)
      resultados.push({ fechaProyectada: isoDate(fecha), montoProyectado: montoBase })
    }
  }

  return resultados
}
