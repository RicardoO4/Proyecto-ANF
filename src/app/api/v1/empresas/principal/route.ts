// GET /api/v1/empresas/principal — empresa used by default across the UI (A4).
import { NextResponse } from 'next/server'
import { handle } from '@/lib/errors'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'

export async function GET(req: Request) {
  return handle(req, async () => NextResponse.json(await getEmpresaPrincipal()))
}
