// POST /api/v1/ventas-historicas/upload — Excel upload (#2).
// Sheet 'metadata': B2 → empresaId. Sheet 'ventas': A fecha (date), B monto,
// C observación. Rows with non-date/non-numeric cells are skipped.
import { NextResponse } from 'next/server'
import { archiveUpload, parseVentas } from '@/lib/excel'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, NotFoundException, handle } from '@/lib/errors'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      throw new BadRequestException('El archivo de Excel es obligatorio.')
    }
    const buffer = await file.arrayBuffer()
    const parsed = parseVentas(buffer)

    // archive the raw workbook (best-effort)
    await archiveUpload(file, 'ventas')

    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', parsed.empresaId)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    for (const venta of parsed.ventas) {
      const localDate = venta.fechaVenta
      const mes = localDate.getFullYear()
      const month = localDate.getMonth()
      const anio = mes
      const { data: dup, error: dupError } = await supabaseAdmin
        .from('venta')
        .select('id_venta')
        .eq('empresa_id', parsed.empresaId)
        .gte('fecha_venta', `${anio}-${String(month + 1).padStart(2, '0')}-01`)
        .lt('fecha_venta', `${month === 11 ? anio + 1 : anio}-${String(month === 11 ? 1 : month + 2).padStart(2, '0')}-01`)
        .limit(1)
      if (dupError) throw dupError
      if (dup && dup.length > 0) {
        throw new BadRequestException(
          `Ya existe una venta registrada para ${MESES[month]} de ${anio} en esta empresa.`,
        )
      }
    }

    const rows = parsed.ventas.map((v) => ({
      empresa_id: parsed.empresaId,
      fecha_venta: isoDate(v.fechaVenta),
      monto_venta: Number(v.montoVenta.toFixed(2)),
      observacion: v.observacion,
    }))
    const { error } = await supabaseAdmin
      .from('venta')
      .insert(rows as unknown as Record<string, unknown>[])
    if (error) throw error

    return new NextResponse(null, { status: 201 })
  })
}
