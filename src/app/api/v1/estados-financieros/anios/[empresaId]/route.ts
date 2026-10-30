// GET /api/v1/estados-financieros/anios/[empresaId]
// Distinct years that have lines, ordered DESC (ties to the original JPQL).
import { supabaseAdmin } from '@/lib/supabase/admin'
import { handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ empresaId: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const empresaId = Number((await params).empresaId)
    const { data, error } = await supabaseAdmin
      .from('linea_estado_financiero')
      .select('estado_financiero!inner(anio, empresa_id)')
      .eq('estado_financiero.empresa_id', empresaId)
    if (error) throw error
    const anios = [...new Set(((data ?? []) as unknown as { estado_financiero: { anio: number } }[]).map((r) => r.estado_financiero.anio))]
      .sort((a, b) => b - a) // DESC
    return NextResponse.json(anios)
  })
}
