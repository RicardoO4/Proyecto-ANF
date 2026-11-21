import { handle, BadRequestException } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { recalcularRatios } from '@/lib/ratios'
export const maxDuration = 300
export async function POST(req: Request) {
  return handle(req, async () => {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body) || (body.forzar !== undefined && typeof body.forzar !== 'boolean')) throw new BadRequestException('Se espera JSON con forzar opcional de tipo booleano.')
    const empresa = await getEmpresaPrincipal()
    const { data, error } = await supabaseAdmin.from('estado_financiero').select('anio').eq('empresa_id', empresa.empresaId)
    if (error) throw error
    const anios = [...new Set((data ?? []).map(r => Number(r.anio)))].sort((a, b) => a - b)
    const resultados = []
    for (const anio of anios) resultados.push({ anio, ...await recalcularRatios(empresa.empresaId, anio, body.forzar === true) })
    return Response.json({ resultados, calculados: resultados.reduce((s, r) => s + r.calculados, 0), omitidos: resultados.reduce((s, r) => s + r.omitidos, 0), actualizados: resultados.filter(r => r.actualizado).length, avisos: resultados.flatMap(r => r.avisos) })
  })
}
