import { handle, BadRequestException } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { obtenerVentasProyeccion } from '@/lib/ventasProyeccionServidor'
import { pronosticarVentas } from '@/lib/pronosticos'

export async function GET(req: Request) {
  return handle(req, async () => {
    const params = new URL(req.url).searchParams
    const periodicidad = params.get('periodicidad') ?? 'anual'
    if (periodicidad !== 'anual' && periodicidad !== 'mensual') throw new BadRequestException('Periodicidad inválida.')
    const empresa = await getEmpresaPrincipal()
    const {ventas,excluidos} = await obtenerVentasProyeccion(empresa.empresaId,periodicidad)
    return Response.json({ empresaId: empresa.empresaId, excluidos, ...pronosticarVentas(ventas, periodicidad, Number(params.get('periodos') ?? 3)) })
  })
}
