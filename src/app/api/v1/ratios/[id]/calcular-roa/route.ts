// PUT /api/v1/ratios/[id]/calcular-roa
import { calcularROA } from '@/lib/ratios'
import { handle } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    return calcularROA(id)
  })
}
