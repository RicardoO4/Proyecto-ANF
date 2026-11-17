// /api/v1/evaluaciones-capital/[id] — una evaluación guardada (Módulo E, E3)
// GET → { id, nombre, datos, ... } · PUT { nombre?, datos } · DELETE
import { handle } from '@/lib/errors'
import {
  CONFIG_CAPITAL,
  actualizarDocumento,
  conTablas,
  eliminarDocumento,
  obtenerDocumento,
} from '@/lib/documentosGuardados'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  return handle(req, () => conTablas(req, () => obtenerDocumento(CONFIG_CAPITAL, req, id)))
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  return handle(req, () => conTablas(req, () => actualizarDocumento(CONFIG_CAPITAL, req, id)))
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  return handle(req, () => conTablas(req, () => eliminarDocumento(CONFIG_CAPITAL, req, id)))
}
