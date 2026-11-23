import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  BadRequestException,
  BusinessRuleException,
  NotFoundException,
  handle,
} from '@/lib/errors'
import { leerEmpresaId, leerCuerpoInventario, validarProductoInventario, productoDTO } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

async function tieneHistorial(empresaId: number, productoId: number) {
  const resultados = await Promise.all(['movimiento_inventario', 'venta_detalle'].map(tabla => supabaseAdmin
    .from(tabla).select('*', { count: 'exact', head: true }).eq('empresa_id', empresaId).eq('producto_id', productoId)))
  for (const resultado of resultados) if (resultado.error) throw resultado.error
  return resultados.some(resultado => (resultado.count ?? 0) > 0)
}

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const { data, error } = await supabaseAdmin
      .from('producto')
      .select('*')
      .eq('id_producto', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException('Producto no encontrado')
    return NextResponse.json(productoDTO(data))
  })
}

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const body = await leerCuerpoInventario(req)
    if (body.idProducto != null && Number(body.idProducto) !== id) {
      throw new BadRequestException('El identificador del producto no coincide con la ruta.')
    }
    const empresaId = leerEmpresaId(body.empresaId)
    const { data: current, error: errorActual } = await supabaseAdmin
      .from('producto')
      .select('id_producto, stock_actual')
      .eq('id_producto', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (errorActual) throw errorActual
    if (!current) throw new NotFoundException('Producto no encontrado')

    const valores = validarProductoInventario(body, empresaId)
    if (Number(current.stock_actual) !== valores.stock_actual && await tieneHistorial(empresaId, id)) {
      throw new BusinessRuleException('El producto tiene historial. Cambie sus existencias mediante Movimientos.')
    }
    const { data: dup, error: errorDuplicado } = await supabaseAdmin
      .from('producto')
      .select('id_producto')
      .eq('empresa_id', empresaId)
      .eq('codigo_sku', valores.codigo_sku)
      .maybeSingle()
    if (errorDuplicado) throw errorDuplicado
    if (dup && Number((dup as { id_producto: number }).id_producto) !== id) {
      throw new BusinessRuleException('Ya existe un producto con ese SKU.')
    }

    const { data, error } = await supabaseAdmin
      .from('producto')
      .update(valores)
      .eq('id_producto', id)
      .eq('empresa_id', empresaId)
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json(productoDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const { data: current, error: errorActual } = await supabaseAdmin
      .from('producto')
      .select('id_producto')
      .eq('id_producto', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (errorActual) throw errorActual
    if (!current) throw new NotFoundException('Producto no encontrado')
    if (await tieneHistorial(empresaId, id)) throw new BusinessRuleException('El producto tiene historial. Desactívelo en lugar de eliminarlo.')
    const { error } = await supabaseAdmin
      .from('producto')
      .delete()
      .eq('id_producto', id)
      .eq('empresa_id', empresaId)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
