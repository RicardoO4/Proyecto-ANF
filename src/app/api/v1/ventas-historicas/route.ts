// POST /api/v1/ventas-historicas — manual batch insert of ventas.
// Body: { empresaId: number, ventas: [{ fechaVenta: 'YYYY-MM-DD',
//   montoVenta: number, observacion?: string }] }
// Business rules preserved: empty list → 400; duplicate (empresa, month,
// year) → 400 with the month name in the message.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
]

export async function POST(req: Request) {
  return handle(req, async () => {
    const body = (await req.json()) as {
      empresaId?: number
      ventas?: { fechaVenta?: string; montoVenta?: number; observacion?: string | null }[]
    }
    const empresaId = Number(body.empresaId)
    const ventas = body.ventas ?? []
    if (!Number.isFinite(empresaId)) {
      throw new BadRequestException('El empresaId es obligatorio.')
    }
    if (ventas.length === 0) {
      throw new BadRequestException('La lista de ventas no puede estar vacía.')
    }
    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    for (const venta of ventas) {
      if (!venta.fechaVenta || venta.montoVenta == null) {
        throw new BadRequestException('Cada venta requiere fechaVenta y montoVenta.')
      }
      const fecha = new Date(venta.fechaVenta + (venta.fechaVenta.length === 10 ? 'T00:00:00Z' : ''))
      if (Number.isNaN(fecha.getTime())) {
        throw new BadRequestException(`Fecha inválida: ${venta.fechaVenta}`)
      }
      const mes = fecha.getUTCMonth()
      const anio = fecha.getUTCFullYear()
      const { data: dup, error: dupError } = await supabaseAdmin
        .from('venta')
        .select('id_venta')
        .eq('empresa_id', empresaId)
        .gte('fecha_venta', `${anio}-${String(mes + 1).padStart(2, '0')}-01`)
        .lt('fecha_venta', `${mes === 11 ? anio + 1 : anio}-${String(mes === 11 ? 1 : mes + 2).padStart(2, '0')}-01`)
        .limit(1)
      if (dupError) throw dupError
      if (dup && dup.length > 0) {
        throw new BadRequestException(
          `Ya existe una venta registrada para ${MESES[mes]} de ${anio} en esta empresa.`,
        )
      }
    }

    const rows = ventas.map((v) => ({
      empresa_id: empresaId,
      fecha_venta: v.fechaVenta!.slice(0, 10),
      monto_venta: Number(v.montoVenta!.toFixed(2)),
      observacion: v.observacion ?? null,
    }))
    const { error } = await supabaseAdmin
      .from('venta')
      .insert(rows as unknown as Record<string, unknown>[])
    if (error) throw error
    return new NextResponse(null, { status: 201 })
  })
}
