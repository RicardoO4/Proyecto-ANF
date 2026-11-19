// /api/v1/presupuestos — presupuestos guardados (Módulo E, E1-E2)
// GET ?empresaId=  → lista [{ id, nombre, anio, creadoEn, actualizadoEn }]
// POST { empresaId, nombre, datos } → crea (409 si el nombre ya existe)
// Escribir requiere el acceso de Proyecciones (lib/permisos.ts).
import { handle } from '@/lib/errors'
import { CONFIG_PRESUPUESTO, conTablas, crearDocumento, listarDocumentos } from '@/lib/documentosGuardados'

export async function GET(req: Request) {
  return handle(req, () => conTablas(req, () => listarDocumentos(CONFIG_PRESUPUESTO, req)))
}

export async function POST(req: Request) {
  return handle(req, () => conTablas(req, () => crearDocumento(CONFIG_PRESUPUESTO, req)))
}
