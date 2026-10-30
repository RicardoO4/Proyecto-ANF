// GET /api/v1/ventas-historicas/empresa/[empresaId] — all ventas (fecha asc)
// VentaHistoricaDTO: { id, fechaVenta, montoVenta, observacion, empresaId }
// Parity quirk: empresaId in the DTO was never filled by the original
// backend (always null) — preserved.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ empresaId: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const empresaId = Number((await params).empresaId)
    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', empresaId)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    const { data, error } = await supabaseAdmin
      .from('venta')
      .select('id_venta, fecha_venta, monto_venta, observacion')
      .eq('empresa_id', empresaId)
      .order('fecha_venta', { ascending: true })
    if (error) throw error
    return NextResponse.json(
      ((data ?? []) as {
        id_venta: number
        fecha_venta: string
        monto_venta: number
        observacion: string | null
      }[]).map((v) => ({
        id: v.id_venta,
        fechaVenta: v.fecha_venta,
        montoVenta: Number(v.monto_venta),
        observacion: v.observacion,
        empresaId: null,
      })),
    )
  })
}
