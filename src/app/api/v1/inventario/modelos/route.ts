import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId, parametroDTO, parametrosPorDefecto, productoDTO } from '@/lib/inventarioApi'
import {
  calcularEOQ,
  calcularReorden,
  clasificacionABC,
  type ProductoDemanda,
} from '@/lib/inventarioFormulas'
import { NextResponse } from 'next/server'

interface VentaDetalleRow {
  fecha_venta: string
  venta_detalle: { producto_id: number; cantidad: number }[]
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const params = new URL(req.url).searchParams
    const empresaId = leerEmpresaId(params.get('empresaId'))
    const anio = Number(params.get('anio') ?? new Date().getFullYear())
    if (!Number.isInteger(anio) || anio < 1900 || anio > 2100) {
      throw new ValidationException('anio: Debe ser un año válido')
    }

    const [
      { data: productos, error: errorProductos },
      { data: parametro, error: errorParametro },
      { data: ventasAnios, error: errorVentasAnios },
    ] = await Promise.all([
      supabaseAdmin
        .from('producto')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
        .order('codigo_sku'),
      supabaseAdmin
        .from('parametro_inventario')
        .select('*')
        .eq('empresa_id', empresaId)
        .maybeSingle(),
      supabaseAdmin.from('venta').select('fecha_venta').eq('empresa_id', empresaId),
    ])
    if (errorProductos) throw errorProductos
    if (errorParametro) throw errorParametro
    if (errorVentasAnios) throw errorVentasAnios

    const aniosDisponibles = Array.from(
      new Set((ventasAnios ?? []).map((venta) => Number(String(venta.fecha_venta).slice(0, 4)))),
    )
      .filter((anioDisponible) => Number.isInteger(anioDisponible) && anioDisponible > 0)
      .sort((a, b) => b - a)

    const { data: ventas, error: errorVentas } = await supabaseAdmin
      .from('venta')
      .select('fecha_venta, venta_detalle!inner(producto_id, cantidad)')
      .eq('empresa_id', empresaId)
      .gte('fecha_venta', `${anio}-01-01`)
      .lt('fecha_venta', `${anio + 1}-01-01`)
    if (errorVentas) throw errorVentas

    const demandaPorProducto = new Map<number, number>()
    for (const venta of (ventas ?? []) as unknown as VentaDetalleRow[]) {
      for (const detalle of venta.venta_detalle ?? []) {
        const productoId = Number(detalle.producto_id)
        demandaPorProducto.set(
          productoId,
          (demandaPorProducto.get(productoId) ?? 0) + Number(detalle.cantidad),
        )
      }
    }

    const productosDemanda: ProductoDemanda[] = (productos ?? []).map((row) => {
      const producto = productoDTO(row)
      return {
        id: producto.idProducto,
        codigoSku: producto.codigoSku,
        nombre: producto.nombre,
        demandaAnual: demandaPorProducto.get(producto.idProducto) ?? 0,
        costoUnitario: producto.costoUnitario,
        stockActual: producto.stockActual,
      }
    })

    const supuestos = parametro ? parametroDTO(parametro) : parametrosPorDefecto(empresaId)

    return NextResponse.json({
      anio,
      aniosDisponibles,
      supuestos,
      abc: clasificacionABC(productosDemanda, supuestos.corteA, supuestos.corteB),
      eoq: calcularEOQ(productosDemanda, supuestos.costoPedido, supuestos.tasaMantenimiento),
      reorden: calcularReorden(
        productosDemanda,
        supuestos.leadTimeDias,
        supuestos.diasAnio,
      ),
    })
  })
}
