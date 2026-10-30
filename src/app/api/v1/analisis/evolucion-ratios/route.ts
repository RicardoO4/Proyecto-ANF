// GET /api/v1/analisis/evolucion-ratios?empresaId=&ratios=LIQUIDEZ_CORRIENTE,ROE,...
// Response (Recharts format): [{ anio: '2024', LIQUIDEZ_CORRIENTE: 1.75, ... }]
import { calcularEvolucionRatios } from '@/lib/analisis'
import { handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  return handle(req, async () => {
    const url = new URL(req.url)
    const empresaId = Number(url.searchParams.get('empresaId'))
    const ratios = (url.searchParams.get('ratios') ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
    if (!Number.isFinite(empresaId) || ratios.length === 0) {
      return NextResponse.json([])
    }
    const data = await calcularEvolucionRatios(empresaId, ratios)
    return NextResponse.json(data)
  })
}
