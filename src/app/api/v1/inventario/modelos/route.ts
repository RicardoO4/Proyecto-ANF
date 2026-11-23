import { supabaseAdmin } from '@/lib/supabase/admin'
import { ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId, parametroDTO, parametrosPorDefecto, productoDTO } from '@/lib/inventarioApi'
import { anioVenta, ventasRealesDelAnio } from '@/lib/origenVentas'
import {
  calcularEOQ,
  calcularReorden,
  clasificacionABC,
  type ProductoDemanda,
} from '@/lib/inventarioFormulas'
import { NextResponse } from 'next/server'

interface VentaDetalleRow {
  id_venta: number
  fecha_venta: string
  observacion: string | null
  venta_detalle: { producto_id: number; cantidad: number }[]
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const params = new URL(req.url).searchParams
    const empresaId = leerEmpresaId(params.get('empresaId'))
    const anioSolicitado = params.has('anio') ? Number(params.get('anio')) : null
    if (anioSolicitado !== null && (!Number.isInteger(anioSolicitado) || anioSolicitado < 1900 || anioSolicitado > 2100)) {
      throw new ValidationException('anio: Debe ser un año válido')
    }

    const [
      { data: productos, error: errorProductos },
      { data: parametro, error: errorParametro },
      { data: ventasDetalle, error: errorVentas },
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
      supabaseAdmin
        .from('venta')
        .select('id_venta, fecha_venta, observacion, venta_detalle!inner(producto_id, cantidad)')
        .eq('empresa_id', empresaId),
    ])
    if (errorProductos) throw errorProductos
    if (errorParametro) throw errorParametro
    if (errorVentas) throw errorVentas

    const filasDetalle = (ventasDetalle ?? []) as unknown as VentaDetalleRow[]
    const aniosDisponibles = Array.from(new Set(filasDetalle.map(anioVenta)))
      .filter((anioDisponible) => Number.isInteger(anioDisponible) && anioDisponible > 0)
      .sort((a, b) => b - a)
    const anio = anioSolicitado !== null && aniosDisponibles.includes(anioSolicitado)
      ? anioSolicitado
      : (aniosDisponibles[0] ?? anioSolicitado ?? new Date().getFullYear())

    const demandaPorProducto = new Map<number, number>()
    for (const venta of ventasRealesDelAnio(filasDetalle, anio)) {
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
