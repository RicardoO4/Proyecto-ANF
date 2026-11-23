import { archiveUpload, parseVentas } from '@/lib/excel'
import { BadRequestException, handle } from '@/lib/errors'
import { guardarVentasMensuales } from '@/lib/guardarVentas'
export const maxDuration = 60
export async function POST(req: Request) {
  return handle(req, async () => {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File) || !file.size) throw new BadRequestException('El archivo de Excel es obligatorio.')
    const parsed = parseVentas(await file.arrayBuffer())
    await guardarVentasMensuales(parsed.empresaId, parsed.ventas.map(v => ({
      fechaVenta: v.fechaVenta.toISOString().slice(0, 10), montoVenta: v.montoVenta, observacion: v.observacion,
    })))
    await archiveUpload(file, 'ventas')
    return new Response(null, { status: 201 })
  })
}
