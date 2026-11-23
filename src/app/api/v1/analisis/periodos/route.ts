import { handle } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { obtenerPeriodosFinancieros } from '@/lib/periodosFinancierosServidor'
import { describirPeriodo } from '@/lib/periodoFinanciero'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(req: Request) {
  return handle(req,async () => {
    const empresa = await getEmpresaPrincipal()
    const [contables, estados] = await Promise.all([
      obtenerPeriodosFinancieros(empresa.empresaId),
      supabaseAdmin.from('estado_financiero').select('anio').eq('empresa_id',empresa.empresaId).order('anio',{ascending:false}),
    ])
    if (estados.error) throw estados.error
    return Response.json([...new Set((estados.data ?? []).map(e => Number(e.anio)))].map(anio => describirPeriodo(anio,contables.find(p => p.anio === anio))),{headers:{'Cache-Control':'no-store'}})
  })
}
