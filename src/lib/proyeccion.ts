// src/lib/proyeccion.ts
import { BadRequestException, NotFoundException } from '@/lib/errors'
import type { MetodoProyeccion, ProyeccionDTO, VentaRow } from '@/types'

function round(value: number, scale: number): number {
  const factor = Math.pow(10, scale)
  return Math.round(value * factor) / factor
}

function endOfMonth(year: number, month1Based: number): Date {
  return new Date(Date.UTC(year, month1Based, 0))
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addMonthsLastDay(base: { year: number; month: number }, months: number): Date {
  const total = (base.month - 1) + months
  return endOfMonth(base.year + Math.floor(total / 12), (total % 12) + 1)
}

export function calcularProyeccion(
  empresaId: number,
  ventas: VentaRow[],
  mesesFuturos: number,
  metodo: MetodoProyeccion,
): ProyeccionDTO[] {
  if (!ventas.length) {
    throw new NotFoundException('No hay ventas históricas registradas para esta empresa.')
  }

  const sorted = [...ventas].sort(
    (a, b) => new Date(a.fecha_venta).getTime() - new Date(b.fecha_venta).getTime(),
  )

  // 1. Descartar explícitamente cierres contables o montos anormales > $500,000 que inflan la serie mensual
  const detalle = sorted.filter(v => {
    const obs = (v.observacion || '').toLowerCase()
    const esCierre = obs.includes('generado desde estados financieros') || 
                     obs.includes('cierre') || 
                     obs.includes('total anual')
    const esMontoParasito = Number(v.monto_venta) > 500000
    return !esCierre && !esMontoParasito
  })

  const dataset = detalle.length >= 12 ? detalle : sorted

  // 2. Agrupar por mes (YYYY-MM)
  const byMonth = new Map<string, number>()
  for (const v of dataset) {
    const d = new Date(v.fecha_venta)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    byMonth.set(key, (byMonth.get(key) ?? 0) + Number(v.monto_venta))
  }

  const entradasOrdenadas = [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  
  if (entradasOrdenadas.length < 12) {
    throw new BadRequestException('Se necesitan al menos 12 meses de datos históricos para proyectar.')
  }

  const ultimos12 = entradasOrdenadas.slice(-12)
  const montos = ultimos12.map(([, monto]) => monto)
  const lastKey = ultimos12[ultimos12.length - 1][0]
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
    if (denom === 0) throw new BadRequestException('Error al calcular la proyección.')
    const b = (n * sumXY - sumX * sumY) / denom
    const a = (sumY - b * sumX) / n

    for (let i = 1; i <= mesesFuturos; i++) {
      const x = n + i
      const y = Math.max(0, a + b * x)
      const fecha = addMonthsLastDay(base, i)
      resultados.push({ fechaProyectada: isoDate(fecha), montoProyectado: round(y, 2) })
    }
  } else if (metodo === 'INCREMENTO_PORCENTUAL') {
    let sumaIncrementos = 0
    let sumaBases = 0

    for (let i = 1; i < montos.length; i++) {
      sumaIncrementos += (montos[i] - montos[i - 1])
      sumaBases += montos[i - 1]
    }

    if (sumaBases === 0) {
      throw new BadRequestException('Error: La suma de bases es cero.')
    }

    const rProm = round(sumaIncrementos / sumaBases, 6)
    let montoBase = montos[montos.length - 1]

    for (let i = 1; i <= mesesFuturos; i++) {
      montoBase = Math.max(0, montoBase * (1 + rProm))
      const fecha = addMonthsLastDay(base, i)
      resultados.push({ fechaProyectada: isoDate(fecha), montoProyectado: round(montoBase, 2) })
    }
  } else {
    // INCREMENTO_ABSOLUTO
    const deltas: number[] = []
    for (let i = 1; i < montos.length; i++) {
      deltas.push(montos[i] - montos[i - 1])
    }
    const dProm = round(deltas.reduce((s, d) => s + d, 0) / deltas.length, 2)
    
    let montoBase = montos[montos.length - 1]
    for (let i = 1; i <= mesesFuturos; i++) {
      montoBase = Math.max(0, montoBase + dProm)
      const fecha = addMonthsLastDay(base, i)
      resultados.push({ fechaProyectada: isoDate(fecha), montoProyectado: round(montoBase, 2) })
    }
  }

  return resultados
}

export function proyeccionPromedioMovil(
  ventasHistoricas: number[], 
  periodosAmortiguacion: number = 3, 
  periodosAProyectar: number = 12
): number[] {
  if (ventasHistoricas.length < periodosAmortiguacion) return [];
  const proyecciones: number[] = [];
  const serieTemporal = [...ventasHistoricas];

  for (let i = 0; i < periodosAProyectar; i++) {
    const ultimosDatos = serieTemporal.slice(-periodosAmortiguacion);
    const promedio = ultimosDatos.reduce((sum, val) => sum + val, 0) / periodosAmortiguacion;
    proyecciones.push(Number(promedio.toFixed(2)));
    serieTemporal.push(promedio);
  }

  return proyecciones;
}

export function proyeccionLogaritmica(
  ventasHistoricas: number[], 
  periodosAProyectar: number = 12
): number[] {
  const n = ventasHistoricas.length;
  if (n === 0) return [];

  let sumLnX = 0, sumY = 0, sumY_LnX = 0, sumLnX_cuadrado = 0;
  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const y = ventasHistoricas[i];
    const lnX = Math.log(x);
    sumLnX += lnX;
    sumY += y;
    sumY_LnX += (y * lnX);
    sumLnX_cuadrado += Math.pow(lnX, 2);
  }

  const b = ((n * sumY_LnX) - (sumY * sumLnX)) / ((n * sumLnX_cuadrado) - Math.pow(sumLnX, 2));
  const a = (sumY - (b * sumLnX)) / n;

  const proyecciones: number[] = [];
  for (let i = 1; i <= periodosAProyectar; i++) {
    const xFuturo = n + i;
    const pronostico = a + (b * Math.log(xFuturo));
    proyecciones.push(Number(Math.max(0, pronostico).toFixed(2))); 
  }

  return proyecciones;
}