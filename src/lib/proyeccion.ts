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
/**
 * Pronóstico por Promedios Móviles
 * Calcula el promedio de los últimos 'n' periodos y proyecta hacia el futuro.
 */
export function proyeccionPromedioMovil(
  ventasHistoricas: number[], 
  periodosAmortiguacion: number = 3, 
  periodosAProyectar: number = 12
): number[] {
  if (ventasHistoricas.length < periodosAmortiguacion) return [];
  
  const proyecciones: number[] = [];
  // Copiamos el array para ir añadiendo las proyecciones y usarlas en los cálculos futuros
  const serieTemporal = [...ventasHistoricas];

  for (let i = 0; i < periodosAProyectar; i++) {
    // Tomamos la ventana de los últimos "n" periodos
    const ultimosDatos = serieTemporal.slice(-periodosAmortiguacion);
    const promedio = ultimosDatos.reduce((sum, val) => sum + val, 0) / periodosAmortiguacion;
    
    proyecciones.push(Number(promedio.toFixed(2)));
    serieTemporal.push(promedio); // La proyección se convierte en dato histórico para el mes siguiente
  }

  return proyecciones;
}

/**
 * Pronóstico por Regresión Logarítmica (y = a + b * ln(x))
 * Ideal para curvas de ventas que muestran rendimientos decrecientes.
 */
export function proyeccionLogaritmica(
  ventasHistoricas: number[], 
  periodosAProyectar: number = 12
): number[] {
  const n = ventasHistoricas.length;
  if (n === 0) return [];

  let sumLnX = 0;
  let sumY = 0;
  let sumY_LnX = 0;
  let sumLnX_cuadrado = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1; // Periodo (1, 2, 3...)
    const y = ventasHistoricas[i];
    const lnX = Math.log(x);

    sumLnX += lnX;
    sumY += y;
    sumY_LnX += (y * lnX);
    sumLnX_cuadrado += Math.pow(lnX, 2);
  }

  // Despeje de la pendiente (b)
  const numeradorB = (n * sumY_LnX) - (sumY * sumLnX);
  const denominadorB = (n * sumLnX_cuadrado) - Math.pow(sumLnX, 2);
  const b = numeradorB / denominadorB;

  // Despeje de la intersección (a)
  const a = (sumY - (b * sumLnX)) / n;

  const proyecciones: number[] = [];
  
  // Proyectar para los periodos futuros (n+1, n+2...)
  for (let i = 1; i <= periodosAProyectar; i++) {
    const xFuturo = n + i;
    const pronostico = a + (b * Math.log(xFuturo));
    // Validamos que no existan ventas negativas en la proyección
    proyecciones.push(Number(Math.max(0, pronostico).toFixed(2))); 
  }

  return proyecciones;
}