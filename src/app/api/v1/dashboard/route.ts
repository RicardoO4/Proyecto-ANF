import { handle, BadRequestException } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { obtenerDashboard } from '@/lib/dashboardServidor'

export async function GET(req: Request) {
  return handle(req, async () => {
    const texto = new URL(req.url).searchParams.get('anio')
    const anio = texto === null ? undefined : Number(texto)
    if (anio !== undefined && (!Number.isInteger(anio) || anio < 1900 || anio > 2200)) throw new BadRequestException('Año inválido.')
    const empresa = await getEmpresaPrincipal()
    return Response.json(await obtenerDashboard(empresa, anio), { headers: { 'Cache-Control': 'no-store' } })
  })
}
