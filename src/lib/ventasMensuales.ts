import { BadRequestException } from '@/lib/errors'

export const MARCA_VENTA_ANUAL = 'Generado desde estados financieros '
export const esVentaAnual = (observacion: string | null | undefined) => Boolean(observacion?.startsWith(MARCA_VENTA_ANUAL))
export interface VentaMensual { fechaVenta: string; montoVenta: number; observacion: string | null }

export function fechaFinDeMes(periodo: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) throw new BadRequestException('Seleccione un mes válido.')
  const [anio, mes] = periodo.split('-').map(Number)
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10)
}

export function validarVentasMensuales(entrada: unknown): VentaMensual[] {
  if (!Array.isArray(entrada) || !entrada.length || entrada.length > 600) throw new BadRequestException('Ingrese entre 1 y 600 ventas mensuales.')
  const meses = new Set<string>()
  return entrada.map(v => {
    if (!v || typeof v !== 'object' || typeof v.fechaVenta !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.fechaVenta)) throw new BadRequestException('Cada venta necesita una fecha válida (AAAA-MM-DD).')
    const fecha = new Date(v.fechaVenta + 'T00:00:00Z')
    if (!Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== v.fechaVenta || fecha.getUTCFullYear() < 1900 || fecha.getUTCFullYear() > 2200) throw new BadRequestException('Fecha de venta inválida.')
    if (typeof v.montoVenta !== 'number' || !Number.isFinite(v.montoVenta) || v.montoVenta < 0) throw new BadRequestException('Los montos deben ser números mayores o iguales a cero.')
    const mes = v.fechaVenta.slice(0, 7)
    if (meses.has(mes)) throw new BadRequestException(`El mes ${mes} aparece más de una vez. Ingrese el total mensual en una sola fila.`)
    meses.add(mes)
    const observacion = typeof v.observacion === 'string' ? v.observacion.trim() || null : null
    if (esVentaAnual(observacion)) throw new BadRequestException('La observación de estados financieros está reservada para los totales anuales automáticos.')
    return { fechaVenta: v.fechaVenta, montoVenta: Math.round(v.montoVenta * 100) / 100, observacion }
  })
}

export function disponibilidadMensual(fechas: string[]) {
  const meses = [...new Set(fechas.map(f => f.slice(0, 7)))].sort()
  const indice = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7))
  let consecutivos = meses.length ? 1 : 0
  for (let i = meses.length - 1; i > 0 && indice(meses[i]) - indice(meses[i - 1]) === 1; i--) consecutivos++
  return { total: meses.length, consecutivos, ultimo: meses.at(-1) ?? null, clasica: consecutivos >= 12, avanzada: meses.length >= 3 && consecutivos === meses.length }
}
