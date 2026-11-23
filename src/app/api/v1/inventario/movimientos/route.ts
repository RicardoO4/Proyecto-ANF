import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId, leerCuerpoInventario, errorMovimientoInventario, movimientoDTO } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'
import { leerPaginasInventario } from '@/lib/paginasInventario'

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
    const data = await leerPaginasInventario((desde, hasta) => supabaseAdmin
      .from('movimiento_inventario')
      .select('*, producto!inner(codigo_sku, nombre)')
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .order('id_movimiento', { ascending: false }).range(desde, hasta))
    return NextResponse.json((data ?? []).map(movimientoDTO))
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await leerCuerpoInventario(req)) as MovimientoInput
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
    if (!Number.isInteger(cantidad) || cantidad > 2147483647) {
      throw new ValidationException('cantidad: Debe ser un número entero de unidades')
    }
    if (typeof body.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha) || Number.isNaN(Date.parse(body.fecha)) || new Date(body.fecha).toISOString().slice(0, 10) !== body.fecha) {
      throw new ValidationException('fecha: Fecha inválida')
    }

    if (body.observacion != null && typeof body.observacion !== 'string') throw new ValidationException('observacion: Debe ser texto.')
    const { data: movimiento, error } = await supabaseAdmin.rpc('inventario_registrar_movimiento', {
      p_empresa: empresaId, p_producto: productoId, p_tipo: body.tipoMovimiento,
      p_cantidad: cantidad, p_fecha: body.fecha, p_observacion: body.observacion ?? null,
    }).single<Record<string, unknown>>()
    if (error) errorMovimientoInventario(error)

    return NextResponse.json(movimientoDTO(movimiento), { status: 201 })
  })
}
