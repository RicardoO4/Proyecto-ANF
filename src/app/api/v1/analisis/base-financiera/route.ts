import { handle, BadRequestException } from '@/lib/errors'
import { obtenerBaseFinanciera } from '@/lib/baseFinanciera'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'

export async function GET(req: Request) {
  return handle(req, async () => {
    const texto = new URL(req.url).searchParams.get('anio')
    const anio = texto === null ? undefined : Number(texto)
    if (anio !== undefined && (!Number.isInteger(anio) || anio < 1900 || anio > 2200)) throw new BadRequestException('Año inválido.')
    const empresa = await getEmpresaPrincipal()
    return Response.json(await obtenerBaseFinanciera(empresa.empresaId, anio, new URL(req.url).searchParams.get('soloCompletos') === '1'))
  })
}
