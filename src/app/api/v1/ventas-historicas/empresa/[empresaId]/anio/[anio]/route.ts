// GET /api/v1/ventas-historicas/empresa/[empresaId]/anio/[anio]
// Ventas whose date falls between Jan 1 and Dec 31 of the year, fecha asc.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NotFoundException, handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ empresaId: string; anio: string }> }

export async function GET(req: Request, { params }: Params) {
  return handle(req, async () => {
    const { empresaId, anio: anioStr } = await params
    const empresaIdNum = Number(empresaId)
    const anio = Number(anioStr)
    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('empresa_id')
      .eq('empresa_id', empresaIdNum)
      .maybeSingle()
    if (!empresa) throw new NotFoundException('Empresa no encontrada')

    const { data, error } = await supabaseAdmin
      .from('venta')
      .select('id_venta, fecha_venta, monto_venta, observacion')
      .eq('empresa_id', empresaIdNum)
      .gte('fecha_venta', `${anio}-01-01`)
      .lte('fecha_venta', `${anio}-12-31`)
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
