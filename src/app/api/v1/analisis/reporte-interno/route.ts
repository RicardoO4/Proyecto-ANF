// GET /api/v1/analisis/reporte-interno?empresaId=&anio1=&anio2=
import { generarReporteInterno } from '@/lib/analisis'
import { handle } from '@/lib/errors'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  return handle(req, async () => {
    const url = new URL(req.url)
    const empresaId = Number(url.searchParams.get('empresaId'))
    const anio1 = Number(url.searchParams.get('anio1'))
    const anio2 = Number(url.searchParams.get('anio2'))
    if (!Number.isFinite(empresaId) || !Number.isFinite(anio1) || !Number.isFinite(anio2)) {
      return NextResponse.json([], { status: 200 })
    }
    const reporte = await generarReporteInterno(empresaId, anio1, anio2)
    return NextResponse.json(reporte)
  })
}
