import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  BadRequestException,
  BusinessRuleException,
  NotFoundException,
  ValidationException,
  handle,
} from '@/lib/errors'
import { leerEmpresaId, productoDTO } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

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
    const body = (await req.json()) as {
      idProducto?: number
      empresaId?: number
      codigoSku?: string
      nombre?: string
      descripcion?: string | null
      costoUnitario?: number
      stockActual?: number
      activo?: boolean
    }
    if (body.idProducto != null && Number(body.idProducto) !== id) {
      throw new BadRequestException('El identificador del producto no coincide con la ruta.')
    }
    const empresaId = leerEmpresaId(body.empresaId)
    const { data: current } = await supabaseAdmin
      .from('producto')
      .select('id_producto')
      .eq('id_producto', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!current) throw new NotFoundException('Producto no encontrado')

    if (!body.codigoSku || !body.nombre || body.costoUnitario == null || body.stockActual == null) {
      throw new ValidationException('Datos incompletos del producto')
    }
    if (!Number.isInteger(Number(body.stockActual))) {
      throw new ValidationException('stockActual: Debe ser un número entero de unidades')
    }
    const { data: dup } = await supabaseAdmin
      .from('producto')
      .select('id_producto')
      .eq('empresa_id', empresaId)
      .eq('codigo_sku', body.codigoSku)
      .maybeSingle()
    if (dup && Number((dup as { id_producto: number }).id_producto) !== id) {
      throw new BusinessRuleException('Ya existe un producto con ese SKU.')
    }

    const { data, error } = await supabaseAdmin
      .from('producto')
      .update({
        codigo_sku: body.codigoSku.trim(),
        nombre: body.nombre.trim(),
        descripcion: body.descripcion ?? null,
        costo_unitario: Number(body.costoUnitario),
        stock_actual: Number(body.stockActual),
        activo: body.activo ?? true,
      })
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
    const { data: current } = await supabaseAdmin
      .from('producto')
      .select('id_producto')
      .eq('id_producto', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!current) throw new NotFoundException('Producto no encontrado')
    const { error } = await supabaseAdmin
      .from('producto')
      .delete()
      .eq('id_producto', id)
      .eq('empresa_id', empresaId)
    if (error) throw error
    return new NextResponse(null, { status: 204 })
  })
}
