// GET /api/v1/presupuestos/sugerencia?empresaId=2 — Módulo E (E1).
//
// Propone las ventas anuales del año a presupuestar a partir de las ventas
// históricas (tabla `venta`, agrupadas por año):
//   crecimiento = tasa anual compuesta entre el primer y el último año
//   propuesta   = ventas del último año × (1 + crecimiento)
// Solo lee la base de datos; basta una sesión válida.
//
// Respuesta: { historico: [{anio, monto}], crecimientoPorcentaje,
//              anioPresupuesto, ventasPropuestas }
import { NextResponse } from 'next/server'
import { BadRequestException, NotFoundException, handle } from '@/lib/errors'
import { obtenerVentasProyeccion } from '@/lib/ventasProyeccionServidor'
import { crecimientoPromedio, redondear } from '@/lib/presupuesto'

export async function GET(req: Request) {
  return handle(req, async () => {
    const empresaId = Number(new URL(req.url).searchParams.get('empresaId'))
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new BadRequestException("El parámetro 'empresaId' es obligatorio.")
    }

    const {ventas: data, excluidos} = await obtenerVentasProyeccion(empresaId,'anual')

    // Agrupa por año (las fechas vienen como 'YYYY-MM-DD'; se lee el año del texto
    // para no depender de la zona horaria).
    const porAnio = new Map<number, number>()
    const aniosContables = new Set((data ?? []).filter(v => v.observacion?.startsWith('Generado desde estados financieros ')).map(v => String(v.fecha_venta).slice(0, 4)))
    for (const v of data ?? []) {
      if (aniosContables.has(String(v.fecha_venta).slice(0, 4)) && !v.observacion?.startsWith('Generado desde estados financieros ')) continue
      const anio = Number(String(v.fecha_venta).slice(0, 4))
      if (Number.isFinite(anio)) porAnio.set(anio, (porAnio.get(anio) ?? 0) + Number(v.monto_venta))
    }
    const historico = [...porAnio.entries()]
      .map(([anio, monto]) => ({ anio, monto: redondear(monto) }))
      .sort((a, b) => a.anio - b.anio)

    if (historico.length === 0) {
      throw new NotFoundException(
        'No hay años completos disponibles para proponer ventas anuales. Los ejercicios provisionales y años con meses faltantes se excluyen.',
      )
    }

    const ultimo = historico.at(-1)!
    const crecimientoPorcentaje = crecimientoPromedio(historico)
    return NextResponse.json({
      historico,
      excluidos,
      crecimientoPorcentaje,
      anioPresupuesto: ultimo.anio + 1,
      ventasPropuestas: redondear(ultimo.monto * (1 + crecimientoPorcentaje / 100)),
    })
  })
}
