// /api/v1/ventas-historicas/[ventaId] — PUT (update), DELETE
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, handle } from '@/lib/errors'
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
    const { data: current } = await supabaseAdmin
      .from('venta')
      .select('id_venta')
      .eq('id_venta', ventaId)
      .maybeSingle()
    if (!current) throw new NotFoundException('Venta no encontrada')

    const updates: Record<string, unknown> = {}
    if (body.fechaVenta) updates.fecha_venta = body.fechaVenta.slice(0, 10)
    if (body.montoVenta != null) updates.monto_venta = Number(body.montoVenta.toFixed(2))
    if (body.observacion !== undefined) updates.observacion = body.observacion

    const { data, error } = await supabaseAdmin
      .from('venta')
      .update(updates)
      .eq('id_venta', ventaId)
      .select('id_venta, fecha_venta, monto_venta, observacion, empresa_id')
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
      .select('id_venta')
      .eq('id_venta', ventaId)
      .maybeSingle()
    if (!current) throw new NotFoundException('Venta no encontrada')
    const { error } = await supabaseAdmin.from('venta').delete().eq('id_venta', ventaId)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
