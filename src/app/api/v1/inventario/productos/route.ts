import { supabaseAdmin } from '@/lib/supabase/admin'
import { BusinessRuleException, handle } from '@/lib/errors'
import { leerEmpresaId, leerCuerpoInventario, validarProductoInventario, productoDTO } from '@/lib/inventarioApi'
import { siguienteCodigoSku } from '@/lib/inventarioSku'
import { leerPaginasInventario } from '@/lib/paginasInventario'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  return handle(req, async () => {
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const data = await leerPaginasInventario((desde, hasta) => supabaseAdmin
      .from('producto')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('codigo_sku').order('id_producto').range(desde, hasta))
    return NextResponse.json((data ?? []).map(productoDTO))
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = await leerCuerpoInventario(req)
    const empresaId = leerEmpresaId(body.empresaId)
    for (let intento = 0; intento < 5; intento++) {
      const existentes = await leerPaginasInventario((desde, hasta) => supabaseAdmin
        .from('producto')
        .select('codigo_sku')
        .eq('empresa_id', empresaId).order('id_producto').range(desde, hasta))
      const codigoSku = siguienteCodigoSku(
        (existentes ?? []).map((fila) => String(fila.codigo_sku)),
      )
      const valores = validarProductoInventario({ ...body, codigoSku }, empresaId)
      const { data, error } = await supabaseAdmin.from('producto').insert(valores).select('*').single()
      if (!error) return NextResponse.json(productoDTO(data), { status: 201 })
      if (error.code !== '23505') throw error
    }
    throw new BusinessRuleException('No se pudo asignar un SKU único. Intente nuevamente.')
  })
}
