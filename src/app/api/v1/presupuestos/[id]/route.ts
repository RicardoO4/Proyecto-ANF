// /api/v1/presupuestos/[id] — un presupuesto guardado (Módulo E, E1-E2)
// GET → { id, nombre, anio, datos, ... } · PUT { nombre?, datos } · DELETE
import { handle } from '@/lib/errors'
import {
  CONFIG_PRESUPUESTO,
  actualizarDocumento,
  conTablas,
  eliminarDocumento,
  obtenerDocumento,
} from '@/lib/documentosGuardados'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  return handle(req, () => conTablas(req, () => obtenerDocumento(CONFIG_PRESUPUESTO, req, id)))
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  return handle(req, () => conTablas(req, () => actualizarDocumento(CONFIG_PRESUPUESTO, req, id)))
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  return handle(req, () => conTablas(req, () => eliminarDocumento(CONFIG_PRESUPUESTO, req, id)))
}
