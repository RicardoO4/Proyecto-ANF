// PUT /api/v1/ratios/[id]/calcular-roe
import { calcularROE } from '@/lib/ratios'
import { handle } from '@/lib/errors'

type Params = { params: Promise<{ id: string }> }

export async function PUT(req: Request, { params }: Params) {
  return handle(req, async () => {
    const id = Number((await params).id)
    return calcularROE(id)
  })
}
