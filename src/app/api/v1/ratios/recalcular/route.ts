import { handle } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { recalcularRatios } from '@/lib/ratios'
export const maxDuration = 300
export async function POST(req: Request) {
  return handle(req, async () => {
    const empresa = await getEmpresaPrincipal()
    const { data, error } = await supabaseAdmin.from('estado_financiero').select('anio').eq('empresa_id', empresa.empresaId)
    if (error) throw error
    const anios = [...new Set((data ?? []).map(r => Number(r.anio)))].sort((a, b) => a - b)
    const resultados = []
    for (const anio of anios) resultados.push({ anio, ...await recalcularRatios(empresa.empresaId, anio) })
    return Response.json({ resultados, calculados: resultados.reduce((s, r) => s + r.calculados, 0), avisos: resultados.flatMap(r => r.avisos) })
  })
}
