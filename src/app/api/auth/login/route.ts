// POST /api/auth/login — original contract:
// { userName, contrasena } → { token, userName, rol, id, accesos: number[] }
import { authenticate } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { userName?: string; contrasena?: string }
    if (!body?.userName || !body?.contrasena) {
      return Response.json(
        {
          timestamp: new Date().toISOString(),
          status: 500,
          error: 'Internal Server Error',
          message: 'Ocurrió un error inesperado. Por favor, contacte al administrador.',
          path: new URL(req.url).pathname,
        },
        { status: 500 },
      )
    }
    const data = await authenticate(body.userName, body.contrasena)
    return Response.json(data, { status: 200 })
  } catch (err) {
    // The original backend mapped login failures to 500 via the global handler
    return errorResponse(req, err)
  }
}
