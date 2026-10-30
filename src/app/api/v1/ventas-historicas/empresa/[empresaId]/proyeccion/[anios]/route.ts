// GET /api/v1/ventas-historicas/empresa/[empresaId]/proyeccion/[anios]?metodo=
// `anios` is the number of future MONTHS. metodo ∈ MINIMOS_CUADRADOS |
// INCREMENTO_PORCENTUAL | INCREMENTO_ABSOLUTO (case-sensitive).
// Response: [{ fechaProyectada: 'YYYY-MM-DD', montoProyectado: number }]
import { calcularProyeccion } from '@/lib/proyeccion'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ empresaId: string; anios: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const { empresaId: empresaStr, anios: aniosStr } = await params
    const empresaId = Number(empresaStr)
    const mesesFuturos = Number(aniosStr)
    const metodo = new URL(req.url).searchParams.get('metodo') ?? ''

    if (!['MINIMOS_CUADRADOS', 'INCREMENTO_PORCENTUAL', 'INCREMENTO_ABSOLUTO'].includes(metodo)) {
      throw new BadRequestException(`Método de proyección inválido: ${metodo}`)
    }

    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    const { data, error } = await supabaseAdmin
      .from('venta')
      .select('id_venta, fecha_venta, monto_venta, observacion, empresa_id')
      .eq('empresa_id', empresaId)
      .order('fecha_venta', { ascending: true })
    if (error) throw error

    const resultados = calcularProyeccion(empresaId, (data ?? []) as never, mesesFuturos, metodo as never)
    return NextResponse.json(resultados)
  })
}
