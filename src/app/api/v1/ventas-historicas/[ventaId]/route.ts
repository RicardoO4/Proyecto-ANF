// /api/v1/ventas-historicas/[ventaId] — PUT (update), DELETE
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, BadRequestException, handle } from '@/lib/errors'
import { guardarVentasMensuales } from '@/lib/guardarVentas'
import { esVentaAnual } from '@/lib/ventasMensuales'
import { esVentaDetalleSku } from '@/lib/origenVentas'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ ventaId: string }> }

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const ventaId = Number((await params).ventaId)
    const body = (await req.json()) as {
      fechaVenta?: string
      montoVenta?: number
      observacion?: string | null
    }
    if (!body) throw new BadRequestException('El cuerpo debe ser JSON.')
    const { data: current, error: errorActual } = await supabaseAdmin
      .from('venta')
      .select('id_venta, fecha_venta, monto_venta, observacion, empresa_id')
      .eq('id_venta', ventaId)
      .maybeSingle()
    if (errorActual) throw errorActual
    if (!current) throw new NotFoundException('Venta no encontrada')
    if (esVentaAnual(current.observacion)) throw new BadRequestException('Este total anual proviene de los estados financieros. Corrija el Excel contable para actualizarlo.')
    if (esVentaDetalleSku(current.observacion)) throw new BadRequestException('Esta venta corresponde al detalle por SKU del módulo de inventarios. No se edita desde el histórico mensual.')

    await guardarVentasMensuales(current.empresa_id, [{ fechaVenta: body.fechaVenta ?? current.fecha_venta, montoVenta: body.montoVenta ?? Number(current.monto_venta), observacion: body.observacion === undefined ? current.observacion : body.observacion }], ventaId)

    const { data, error } = await supabaseAdmin
      .from('venta')
      .select('id_venta, fecha_venta, monto_venta, observacion, empresa_id')
      .eq('id_venta', ventaId)
      .single()
    if (error) throw error
    const v = data as { id_venta: number; fecha_venta: string; monto_venta: number; observacion: string | null; empresa_id: number }
    return NextResponse.json({
      id: v.id_venta,
      fechaVenta: v.fecha_venta,
      montoVenta: Number(v.monto_venta),
      observacion: v.observacion,
      empresaId: v.empresa_id,
    })
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const ventaId = Number((await params).ventaId)
    const { data: current } = await supabaseAdmin
      .from('venta')
      .select('id_venta, observacion')
      .eq('id_venta', ventaId)
      .maybeSingle()
    if (!current) throw new NotFoundException('Venta no encontrada')
    if (esVentaAnual(current.observacion)) throw new BadRequestException('No se elimina un total anual desde el histórico mensual. Actualice sus estados financieros.')
    if (esVentaDetalleSku(current.observacion)) throw new BadRequestException('Esta venta corresponde al detalle por SKU del módulo de inventarios. No se elimina desde el histórico mensual.')
    const { error } = await supabaseAdmin.from('venta').delete().eq('id_venta', ventaId)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
