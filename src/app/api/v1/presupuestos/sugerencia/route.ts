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
import { supabaseAdmin } from '@/lib/supabase/admin'
import { crecimientoPromedio, redondear } from '@/lib/presupuesto'

export async function GET(req: Request) {
  return handle(req, async () => {
    const empresaId = Number(new URL(req.url).searchParams.get('empresaId'))
    if (!Number.isInteger(empresaId) || empresaId <= 0) {
      throw new BadRequestException("El parámetro 'empresaId' es obligatorio.")
    }

    const { data, error } = await supabaseAdmin
      .from('venta')
      .select('fecha_venta, monto_venta, observacion')
      .eq('empresa_id', empresaId)
    if (error) throw error

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
        'La empresa no tiene ventas históricas. Cárguelas en Proyecciones o escriba las unidades a mano.',
      )
    }

    const ultimo = historico.at(-1)!
    const crecimientoPorcentaje = crecimientoPromedio(historico)
    return NextResponse.json({
      historico,
      crecimientoPorcentaje,
      anioPresupuesto: ultimo.anio + 1,
      ventasPropuestas: redondear(ultimo.monto * (1 + crecimientoPorcentaje / 100)),
    })
  })
}
