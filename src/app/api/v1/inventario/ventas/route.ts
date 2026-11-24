import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { leerCuerpoInventario, leerEmpresaId, ventaInventarioDTO } from '@/lib/inventarioApi'
import { leerPaginasInventario } from '@/lib/paginasInventario'
import { NextResponse } from 'next/server'

type VentaInput = {
  empresaId?: number
  productoId?: number
  anio?: number
  cantidad?: number
  precioVentaUnitario?: number
}

function redondear4(valor: number) {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000
}

function redondear2(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const params = new URL(req.url).searchParams
    const empresaId = leerEmpresaId(params.get('empresaId'))
    const anioParam = params.get('anio')
    const anio = anioParam == null ? null : Number(anioParam)
    if (anio !== null && (!Number.isInteger(anio) || anio < 1900 || anio > 2100)) {
      throw new ValidationException('anio: Debe ser un año válido')
    }

    const data = await leerPaginasInventario((desde, hasta) => {
      let query = supabaseAdmin
        .from('venta_detalle')
        .select('id_detalle, venta_id, producto_id, empresa_id, cantidad, precio_unitario, subtotal, venta!inner(id_venta, fecha_venta, observacion), producto!inner(codigo_sku, nombre)')
        .eq('empresa_id', empresaId)
        .order('id_detalle', { ascending: false })
        .range(desde, hasta)
      if (anio !== null) {
        query = query.gte('venta.fecha_venta', `${anio}-01-01`).lte('venta.fecha_venta', `${anio}-12-31`)
      }
      return query
    })

    return NextResponse.json((data ?? []).map(ventaInventarioDTO))
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await leerCuerpoInventario(req)) as VentaInput
    const empresaId = leerEmpresaId(body.empresaId)
    const productoId = Number(body.productoId)
    if (!Number.isInteger(productoId) || productoId <= 0) {
      throw new ValidationException('productoId: Debe seleccionar un producto')
    }
    const anio = Number(body.anio)
    if (!Number.isInteger(anio) || anio < 2023 || anio > 2100) {
      throw new ValidationException('anio: Debe ser un año válido desde 2023')
    }
    const cantidad = Number(body.cantidad)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      throw new ValidationException('cantidad: Debe ser mayor a cero')
    }
    const precioVentaUnitario = Number(body.precioVentaUnitario)
    if (!Number.isFinite(precioVentaUnitario) || precioVentaUnitario <= 0) {
      throw new ValidationException('precioVentaUnitario: Debe ser mayor a cero')
    }

    const { data: producto, error: errorProducto } = await supabaseAdmin
      .from('producto')
      .select('id_producto, codigo_sku, nombre, empresa_id, activo')
      .eq('id_producto', productoId)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (errorProducto) throw errorProducto
    if (!producto) throw new ValidationException('productoId: Producto no encontrado para la empresa')
    if (!producto.activo) throw new ValidationException('productoId: El producto está inactivo')

    const fechaVenta = `${anio}-06-30`
    const observacion = `INV ${anio} ${producto.codigo_sku}`
    const precioUnitario = redondear4(precioVentaUnitario)
    const subtotalRedondeado = redondear2(cantidad * precioVentaUnitario)

    const { data: venta, error: errorVenta } = await supabaseAdmin
      .from('venta')
      .insert({
        empresa_id: empresaId,
        fecha_venta: fechaVenta,
        monto_venta: subtotalRedondeado,
        observacion,
      })
      .select('id_venta, fecha_venta, observacion')
      .single()
    if (errorVenta) throw errorVenta

    const { data: detalle, error: errorDetalle } = await supabaseAdmin
      .from('venta_detalle')
      .insert({
        venta_id: venta.id_venta,
        producto_id: productoId,
        empresa_id: empresaId,
        cantidad,
        precio_unitario: precioUnitario,
        subtotal: subtotalRedondeado,
      })
      .select('id_detalle, venta_id, producto_id, empresa_id, cantidad, precio_unitario, subtotal')
      .single()

    if (errorDetalle) {
      await supabaseAdmin.from('venta').delete().eq('id_venta', venta.id_venta)
      throw errorDetalle
    }

    return NextResponse.json(ventaInventarioDTO({
      ...detalle,
      venta,
      producto,
    }), { status: 201 })
  })
}
