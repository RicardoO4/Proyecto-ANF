// src/lib/proyeccion.ts
import { BadRequestException, NotFoundException } from '@/lib/errors'
import type { MetodoProyeccion, ProyeccionDTO, VentaRow } from '@/types'
import { agruparVentasMensuales } from './fuenteVentasMensuales'

function round(value: number, scale: number): number {
  const factor = Math.pow(10, scale)
  return Math.round(value * factor) / factor
}

/** Unidad III, pp. 55–56: promedio simple de las variaciones relativas. */
export function tasaIncrementoPorcentual(montos: number[]): number {
  if (montos.length < 2 || montos.some(m => !Number.isFinite(m) || m < 0)) throw new BadRequestException('Se requieren al menos dos importes de ventas válidos.')
  const tasas = montos.slice(1).map((monto, i) => {
    const base = montos[i]
    if (base === 0 && monto !== 0) throw new BadRequestException('Incremento porcentual no calculable: hay un periodo con ventas después de una base cero. Los otros métodos siguen disponibles.')
    return base === 0 ? 0 : (monto - base) / base
  })
  return tasas.reduce((suma, tasa) => suma + tasa, 0) / tasas.length
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

  const { historico } = agruparVentasMensuales(ventas)
  const entradasOrdenadas = historico.map(f => [f.periodo, f.monto] as const)
  if (entradasOrdenadas.length < 12) {
    throw new BadRequestException('Se necesitan al menos 12 meses de datos históricos para proyectar.')
  }

  const ultimos12 = entradasOrdenadas.slice(-12)
  const indiceMes = (mes: string) => Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7))
  if (ultimos12.some(([mes], i) => i > 0 && indiceMes(mes) - indiceMes(ultimos12[i - 1][0]) !== 1)) {
    throw new BadRequestException('Se requieren al menos 12 meses consecutivos. No se rellenan periodos faltantes.')
  }
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
    const rProm = tasaIncrementoPorcentual(montos)
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
