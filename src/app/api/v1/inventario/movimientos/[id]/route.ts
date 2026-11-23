import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, ValidationException, handle } from '@/lib/errors'
import { leerEmpresaId, errorMovimientoInventario } from '@/lib/inventarioApi'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    const { data, error } = await supabaseAdmin
      .from('movimiento_inventario')
      .select('*, producto!inner(codigo_sku, nombre)')
      .eq('id_movimiento', id)
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new NotFoundException('Movimiento no encontrado')
    const { movimientoDTO } = await import('@/lib/inventarioApi')
    return NextResponse.json(movimientoDTO(data))
  })
}

export async function DELETE(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    const empresaId = leerEmpresaId(new URL(req.url).searchParams.get('empresaId'))
    if (!Number.isSafeInteger(id) || id <= 0) throw new ValidationException('id: Movimiento inválido.')
    const { error } = await supabaseAdmin.rpc('inventario_eliminar_movimiento', { p_empresa: empresaId, p_movimiento: id })
    if (error) errorMovimientoInventario(error)
    return new NextResponse(null, { status: 204 })
  })
}
