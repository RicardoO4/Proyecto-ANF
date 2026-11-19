// /api/v1/evaluaciones-capital — evaluaciones de presupuesto de capital guardadas (Módulo E, E3)
// GET ?empresaId=  → lista [{ id, nombre, creadoEn, actualizadoEn }]
// POST { empresaId, nombre, datos } → crea (409 si el nombre ya existe)
// Escribir requiere el acceso de Proyecciones (lib/permisos.ts).
import { handle } from '@/lib/errors'
import { CONFIG_CAPITAL, conTablas, crearDocumento, listarDocumentos } from '@/lib/documentosGuardados'

export async function GET(req: Request) {
  return handle(req, () => conTablas(req, () => listarDocumentos(CONFIG_CAPITAL, req)))
}

export async function POST(req: Request) {
  return handle(req, () => conTablas(req, () => crearDocumento(CONFIG_CAPITAL, req)))
}
