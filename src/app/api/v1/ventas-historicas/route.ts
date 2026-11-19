import { handle, BadRequestException } from '@/lib/errors'
import { guardarVentasMensuales } from '@/lib/guardarVentas'
export async function POST(req: Request) {
  return handle(req, async () => {
    const body = await req.json().catch(() => null)
    if (!body) throw new BadRequestException('El cuerpo debe ser JSON.')
    await guardarVentasMensuales(Number(body.empresaId), body.ventas)
    return new Response(null, { status: 201 })
  })
}
