import { handle, BadRequestException } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { pronosticarVentas } from '@/lib/pronosticos'
import type { VentaRow } from '@/types'

export async function GET(req: Request) {
  return handle(req, async () => {
    const params = new URL(req.url).searchParams
    const periodicidad = params.get('periodicidad') ?? 'anual'
    if (periodicidad !== 'anual' && periodicidad !== 'mensual') throw new BadRequestException('Periodicidad inválida.')
    const empresa = await getEmpresaPrincipal()
    const { data, error } = await supabaseAdmin.from('venta').select('*').eq('empresa_id', empresa.empresaId).order('fecha_venta')
    if (error) throw error
    return Response.json({ empresaId: empresa.empresaId, ...pronosticarVentas((data ?? []) as VentaRow[], periodicidad, Number(params.get('periodos') ?? 3)) })
  })
}
