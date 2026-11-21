import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, handle } from '@/lib/errors'
import { leerEmpresaId } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const { data, error } = await supabaseAdmin
      .from('movimiento_inventario')
      .select('*, producto!inner(codigo_sku, nombre)')
      .eq('id_movimiento', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException('Movimiento no encontrado')
    const { movimientoDTO } = await import('@/lib/inventarioApi')
    return NextResponse.json(movimientoDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const { data: movimiento } = await supabaseAdmin
      .from('movimiento_inventario')
      .select('*')
      .eq('id_movimiento', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!movimiento) throw new NotFoundException('Movimiento no encontrado')

    const { data: producto } = await supabaseAdmin
      .from('producto')
      .select('stock_actual')
      .eq('id_producto', Number(movimiento.producto_id))
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (producto) {
      const cantidad = Number(movimiento.cantidad)
      const nuevoStock =
        movimiento.tipo_movimiento === 'ENTRADA'
          ? Number(producto.stock_actual) - cantidad
          : Number(producto.stock_actual) + cantidad
      await supabaseAdmin
        .from('producto')
        .update({ stock_actual: Math.max(0, nuevoStock) })
        .eq('id_producto', Number(movimiento.producto_id))
        .eq('empresa_id', empresaId)
    }

    const { error } = await supabaseAdmin
      .from('movimiento_inventario')
      .delete()
      .eq('id_movimiento', id)
      .eq('empresa_id', empresaId)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
