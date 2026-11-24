import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId, ventaInventarioDTO } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationException('id: Venta inválida.')

    const { data, error } = await supabaseAdmin
      .from('venta_detalle')
      .select('id_detalle, venta_id, producto_id, empresa_id, cantidad, precio_unitario, subtotal, venta!inner(id_venta, fecha_venta, observacion), producto!inner(codigo_sku, nombre)')
      .eq('id_detalle', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException('Venta de inventario no encontrada')
    return NextResponse.json(ventaInventarioDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationException('id: Venta inválida.')

    const { data, error } = await supabaseAdmin
      .from('venta_detalle')
      .select('id_detalle, venta_id, venta!inner(observacion)')
      .eq('id_detalle', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException('Venta de inventario no encontrada')

    const observacion = String((data.venta as { observacion?: string | null } | null)?.observacion ?? '')
    if (!/^INV \d{4} /.test(observacion)) {
      throw new ValidationException('Solo se pueden eliminar ventas SKU de inventario desde este módulo.')
    }

    const { error: errorVenta } = await supabaseAdmin.from('venta').delete().eq('id_venta', data.venta_id).eq('empresa_id', empresaId)
    if (errorVenta) throw errorVenta
    return new NextResponse(null, { status: 204 })
  })
}
