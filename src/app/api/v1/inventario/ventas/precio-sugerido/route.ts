import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  return handle(req, async () => {
    const params = new URL(req.url).searchParams
    const empresaId = leerEmpresaId(params.get('empresaId'))
    const productoId = Number(params.get('productoId'))
    if (!Number.isInteger(productoId) || productoId <= 0) {
      throw new ValidationException('productoId: Debe seleccionar un producto')
    }

    const { data, error } = await supabaseAdmin
      .from('venta_detalle')
      .select('precio_unitario, venta!inner(fecha_venta, observacion, empresa_id)')
      .eq('empresa_id', empresaId)
      .eq('producto_id', productoId)
      .like('venta.observacion', 'INV %')
      .order('id_detalle', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({
      precioVentaUnitario: data?.precio_unitario == null ? null : Number(data.precio_unitario),
    })
  })
}
