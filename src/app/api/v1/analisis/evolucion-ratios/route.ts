// GET /api/v1/analisis/evolucion-ratios?empresaId=&ratios=LIQUIDEZ_CORRIENTE,ROE,...
// Response (Recharts format): [{ anio: '2024', LIQUIDEZ_CORRIENTE: 1.75, ... }]
import { calcularEvolucionRatios } from '@/lib/analisis'
import { handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  return handle(req, async () => {
    const url = new URL(req.url)
    const empresaId = Number(url.searchParams.get('empresaId'))
    // Accepts both "ratios=A,B" and axios-style "ratios[]=A&ratios[]=B"
    const ratios = [...url.searchParams.entries()]
      .filter(([key]) => key === 'ratios' || key === 'ratios[]')
      .flatMap(([, value]) => value.split(','))
      .map((r) => r.trim())
      .filter(Boolean)
    if (!Number.isFinite(empresaId) || ratios.length === 0) {
      return NextResponse.json([])
    }
    const data = await calcularEvolucionRatios(empresaId, ratios)
    // Maps must be converted to plain objects: JSON.stringify(Map) = {}
    return NextResponse.json(data.map((entry) => Object.fromEntries(entry)))
  })
}
