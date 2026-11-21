import { supabaseAdmin } from '@/lib/supabase/admin'
import { BusinessRuleException, ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId, productoDTO } from '@/lib/inventarioApi'
import { siguienteCodigoSku } from '@/lib/inventarioSku'
import { NextResponse } from 'next/server'

type ProductoInput = {
  empresaId?: number
  codigoSku?: string
  nombre?: string
  descripcion?: string | null
  costoUnitario?: number
  stockActual?: number
  activo?: boolean
}

function validar(body: ProductoInput, empresaId: number) {
  if (!body.codigoSku || body.codigoSku.trim() === '') {
    throw new ValidationException('codigoSku: El SKU es obligatorio')
  }
  if (!body.nombre || body.nombre.trim() === '') {
    throw new ValidationException('nombre: El nombre es obligatorio')
  }
  if (body.costoUnitario == null || Number(body.costoUnitario) < 0) {
    throw new ValidationException('costoUnitario: Debe ser mayor o igual a cero')
  }
  if (body.stockActual == null || Number(body.stockActual) < 0) {
    throw new ValidationException('stockActual: Debe ser mayor o igual a cero')
  }
  if (!Number.isInteger(Number(body.stockActual))) {
    throw new ValidationException('stockActual: Debe ser un número entero de unidades')
  }
  return {
    empresa_id: empresaId,
    codigo_sku: body.codigoSku.trim(),
    nombre: body.nombre.trim(),
    descripcion: body.descripcion ?? null,
    costo_unitario: Number(body.costoUnitario),
    stock_actual: Number(body.stockActual),
    activo: body.activo ?? true,
  }
}

export async function GET(req: Request) {
  return handle(req, async () => {
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const { data, error } = await supabaseAdmin
      .from('producto')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('codigo_sku')
    if (error) throw error
    return NextResponse.json((data ?? []).map(productoDTO))
  })
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as ProductoInput
    const empresaId = leerEmpresaId(body.empresaId)
    for (let intento = 0; intento < 5; intento++) {
      const { data: existentes, error: errorSkus } = await supabaseAdmin
        .from('producto')
        .select('codigo_sku')
        .eq('empresa_id', empresaId)
      if (errorSkus) throw errorSkus
      const codigoSku = siguienteCodigoSku(
        (existentes ?? []).map((fila) => String(fila.codigo_sku)),
      )
      const valores = validar({ ...body, codigoSku }, empresaId)
      const { data, error } = await supabaseAdmin.from('producto').insert(valores).select('*').single()
      if (!error) return NextResponse.json(productoDTO(data), { status: 201 })
      if (error.code !== '23505') throw error
    }
    throw new BusinessRuleException('No se pudo asignar un SKU único. Intente nuevamente.')
  })
}
