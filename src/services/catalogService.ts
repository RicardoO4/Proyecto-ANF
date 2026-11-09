// catalogService — master catalog grouped by cumulative accounts + per-company activation
// Base: /api/v1 (paths replicate the combined controller prefixes).
import { apiClient } from './api'

export interface CuentaNode {
  cuentaId: number
  codigoCuenta: string
  nombreCuenta: string
  esMovimiento: boolean
  children?: CuentaNode[]
}

export interface CuentaCatalogo {
  cuentaId: number
  codigoCuenta: string
  nombreCuenta: string
  esMovimiento: boolean
}

export interface CatalogoActivo {
  idCatalogo: number
  cuentaId: number
  codigoCuenta: string
  nombreCuenta: string
}

export interface CuentaFila extends CuentaCatalogo {
  activa: boolean
  idCatalogo: number | null
}

export interface ElementoGrupo {
  tipo: 'grupo'
  fila: CuentaFila
  cuentaIds: number[]
}

export interface ElementoCuenta {
  tipo: 'cuenta'
  fila: CuentaFila
}

export type ElementoCatalogo = ElementoGrupo | ElementoCuenta

export interface CuentaSecciones {
  elementos: ElementoCatalogo[]
  filas: CuentaFila[]
}

/** Numeric-aware code comparison so 1101 < 110101 and 2 < 10. */
function compareCodigo(a: string, b: string): number {
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
}

/** A node renders as a row when it is a movement account or a leaf. */
function esFila(node: CuentaNode): boolean {
  return Boolean(node.esMovimiento) || !node.children || node.children.length === 0
}

export const catalogService = {
  async getMasterNodes(): Promise<CuentaNode[]> {
    const resp = await apiClient.get<CuentaNode[]>('/cuentas-maestro/tree')
    return resp.data
  },
  async activarCuentas(payload: { empresaId: number; cuentaIds: number[] }): Promise<void> {
    await apiClient.post('/catalogo-empresa/activar', payload)
  },
  async getCatalogoActivoPorEmpresa(empresaId: number): Promise<CatalogoActivo[]> {
    const resp = await apiClient.get<CatalogoActivo[]>(`/catalogo-empresa/empresa/${empresaId}`)
    return resp.data
  },
  async desactivarCuentas(payload: { catalogoIds: number[] }): Promise<void> {
    await apiClient.post('/catalogo-empresa/desactivar', payload)
  },
}

/**
 * Walks the master tree and produces a flat render list where every cumulative
 * account that directly groups movement accounts becomes a section title,
 * followed by those rows. Active accounts missing from the master tree are
 * appended as standalone rows.
 */
export function buildCuentaSecciones(
  master: CuentaNode[],
  activos: CatalogoActivo[],
): CuentaSecciones {
  const activosPorCuenta = new Map(activos.map((item) => [item.cuentaId, item]))
  const elementos: ElementoCatalogo[] = []
  const filas: CuentaFila[] = []
  const vistos = new Set<number>()

  const filaDe = (cuenta: CuentaCatalogo): CuentaFila => {
    const activo = activosPorCuenta.get(cuenta.cuentaId)
    return {
      ...cuenta,
      activa: Boolean(activo),
      idCatalogo: activo?.idCatalogo ?? null,
    }
  }

  const emitirCuenta = (node: CuentaNode) => {
    const fila = filaDe({
      cuentaId: node.cuentaId,
      codigoCuenta: node.codigoCuenta,
      nombreCuenta: node.nombreCuenta,
      esMovimiento: Boolean(node.esMovimiento),
    })
    elementos.push({ tipo: 'cuenta', fila })
    filas.push(fila)
  }

  const recorrer = (nodes: CuentaNode[]) => {
    for (const node of nodes) {
      if (vistos.has(node.cuentaId)) continue
      vistos.add(node.cuentaId)

      if (esFila(node)) {
        emitirCuenta(node)
        continue
      }

      const children = node.children ?? []
      const filasHijas = children.filter(esFila)

      if (filasHijas.length > 0) {
        elementos.push({
          tipo: 'grupo',
          fila: filaDe({
            cuentaId: node.cuentaId,
            codigoCuenta: node.codigoCuenta,
            nombreCuenta: node.nombreCuenta,
            esMovimiento: false,
          }),
          cuentaIds: filasHijas.map((child) => child.cuentaId),
        })
      }

      for (const child of children) {
        if (esFila(child)) {
          if (vistos.has(child.cuentaId)) continue
          vistos.add(child.cuentaId)
          emitirCuenta(child)
        } else {
          recorrer([child])
        }
      }
    }
  }

  recorrer(master)

  const huerfanas = activos
    .filter((item) => !vistos.has(item.cuentaId))
    .sort((a, b) => compareCodigo(a.codigoCuenta, b.codigoCuenta))

  for (const activo of huerfanas) {
    const fila: CuentaFila = {
      cuentaId: activo.cuentaId,
      codigoCuenta: activo.codigoCuenta,
      nombreCuenta: activo.nombreCuenta,
      esMovimiento: false,
      activa: true,
      idCatalogo: activo.idCatalogo,
    }
    elementos.push({ tipo: 'cuenta', fila })
    filas.push(fila)
  }

  return { elementos, filas }
}
