import { supabaseAdmin } from '@/lib/supabase/admin'
import { BusinessRuleException, NotFoundException, ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId, movimientoDTO } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'

type MovimientoInput = {
  empresaId?: number
  productoId?: number
  tipoMovimiento?: string
  cantidad?: number
  fecha?: string
  observacion?: string | null
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const { data, error } = await supabaseAdmin
      .from('movimiento_inventario')
      .select('*, producto!inner(codigo_sku, nombre)')
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .order('id_movimiento', { ascending: false })
    if (error) throw error
    return NextResponse.json((data ?? []).map(movimientoDTO))
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as MovimientoInput
    const empresaId = leerEmpresaId(body.empresaId)
    const productoId = Number(body.productoId)
    if (!Number.isInteger(productoId) || productoId <= 0) {
      throw new ValidationException('productoId: Debe seleccionar un producto')
    }
    if (body.tipoMovimiento !== 'ENTRADA' && body.tipoMovimiento !== 'SALIDA') {
      throw new ValidationException('tipoMovimiento: Debe ser ENTRADA o SALIDA')
    }
    const cantidad = Number(body.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new ValidationException('cantidad: Debe ser mayor a cero')
    }
    if (!Number.isInteger(cantidad)) {
      throw new ValidationException('cantidad: Debe ser un número entero de unidades')
    }
    if (!body.fecha || Number.isNaN(Date.parse(body.fecha))) {
      throw new ValidationException('fecha: Fecha inválida')
    }

    const { data: producto, error: errorProducto } = await supabaseAdmin
      .from('producto')
      .select('id_producto, stock_actual')
      .eq('id_producto', productoId)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (errorProducto) throw errorProducto
    if (!producto) throw new NotFoundException('Producto no encontrado')

    const stockActual = Number(producto.stock_actual)
    const nuevoStock = body.tipoMovimiento === 'ENTRADA' ? stockActual + cantidad : stockActual - cantidad
    if (nuevoStock < 0) {
      throw new BusinessRuleException('Stock insuficiente para registrar la salida.')
    }

    const { data: movimiento, error: errorMovimiento } = await supabaseAdmin
      .from('movimiento_inventario')
      .insert({
        empresa_id: empresaId,
        producto_id: productoId,
        tipo_movimiento: body.tipoMovimiento,
        cantidad,
        fecha: body.fecha,
        observacion: body.observacion ?? null,
      })
      .select('*')
      .single()
    if (errorMovimiento) throw errorMovimiento

    const { error: errorStock } = await supabaseAdmin
      .from('producto')
      .update({ stock_actual: nuevoStock })
      .eq('id_producto', productoId)
      .eq('empresa_id', empresaId)
    if (errorStock) throw errorStock

    return NextResponse.json(movimientoDTO(movimiento), { status: 201 })
  })
}
