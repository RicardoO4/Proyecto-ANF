import { handle } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { disponibilidadMensual, esVentaAnual } from '@/lib/ventasMensuales'

export async function GET(req: Request) {
  return handle(req, async () => {
    const { empresaId } = await getEmpresaPrincipal()
    const { data, error } = await supabaseAdmin.from('venta').select('fecha_venta, observacion').eq('empresa_id', empresaId)
    if (error) throw error
    const filas = data ?? []
    return Response.json({ empresaId, ...disponibilidadMensual(filas.filter(v => !esVentaAnual(v.observacion)).map(v => v.fecha_venta)), totalesAnuales: filas.filter(v => esVentaAnual(v.observacion)).length })
  })
}
