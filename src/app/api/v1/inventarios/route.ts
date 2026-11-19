import { handle, BadRequestException, BusinessRuleException, NotFoundException } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { analizarInventarios, validarProducto, type ProductoInventario } from '@/lib/inventarios'

function revisar(error: { code?: string; message?: string } | null) {
  if (!error) return
  if (error.code === 'PGRST205' || error.code === '42P01') throw new BusinessRuleException('Falta aplicar la migración 008 de inventarios y ratios en Supabase.')
  if (error.code === '23505') throw new BusinessRuleException('Ya existe un producto con ese código.')
  throw error
}
export async function GET(req: Request) {
  return handle(req, async () => {
    const { empresaId } = await getEmpresaPrincipal()
    const { data, error } = await supabaseAdmin.from('inventario_producto').select('*').eq('empresa_id', empresaId)
    revisar(error)
    const productos = (data ?? []).map(row => {
      const producto = { ...row } as ProductoInventario
      for (const campo of ['demanda_anual', 'costo_unitario', 'costo_pedido', 'costo_mantenimiento_anual', 'plazo_entrega_dias', 'stock_seguridad', 'dias_operacion', 'existencias'] as const) producto[campo] = Number(producto[campo])
      return producto
    })
    return Response.json(analizarInventarios(productos))
  })
}
async function guardar(req: Request, actualizar: boolean) {
  return handle(req, async () => {
    const body: unknown = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Producto inválido.')
    const p = body as ProductoInventario
    const errores = validarProducto(p)
    if (errores.length) throw new BadRequestException(errores.join(' '))
    const { empresaId } = await getEmpresaPrincipal()
    const valores = { empresa_id: empresaId, codigo: p.codigo.trim(), nombre: p.nombre.trim(), demanda_anual: p.demanda_anual, costo_unitario: p.costo_unitario, costo_pedido: p.costo_pedido, costo_mantenimiento_anual: p.costo_mantenimiento_anual, plazo_entrega_dias: p.plazo_entrega_dias, stock_seguridad: p.stock_seguridad, dias_operacion: p.dias_operacion, existencias: p.existencias }
    if (actualizar && (!Number.isSafeInteger(p.id_producto) || Number(p.id_producto) <= 0)) throw new BadRequestException('ID de producto inválido.')
    const consulta = actualizar ? supabaseAdmin.from('inventario_producto').update(valores).eq('empresa_id', empresaId).eq('id_producto', p.id_producto!) : supabaseAdmin.from('inventario_producto').insert(valores)
    const { data, error } = await consulta.select('id_producto').maybeSingle()
    revisar(error)
    if (!data) throw new NotFoundException('Producto no encontrado.')
    return Response.json(data, { status: actualizar ? 200 : 201 })
  })
}
export const POST = (req: Request) => guardar(req, false)
export const PUT = (req: Request) => guardar(req, true)
export async function DELETE(req: Request) {
  return handle(req, async () => {
    const id = Number(new URL(req.url).searchParams.get('id'))
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('ID inválido.')
    const { empresaId } = await getEmpresaPrincipal()
    const { data, error } = await supabaseAdmin.from('inventario_producto').delete().eq('empresa_id', empresaId).eq('id_producto', id).select('id_producto').maybeSingle()
    revisar(error)
    if (!data) throw new NotFoundException('Producto no encontrado.')
    return new Response(null, { status: 204 })
  })
}
