// catalogService — master tree + per-company activation
// Base: /api/v1 (paths replicate the combined controller prefixes).
import { apiClient } from './api'

export interface CuentaNode {
  cuentaId: number
  codigoCuenta: string
  nombreCuenta: string
  esMovimiento: boolean
  children?: CuentaNode[]
}

export interface RCTreeNode {
  key: number
  title: string
  children?: RCTreeNode[]
  isLeaf?: boolean
  disableCheckbox?: boolean
  originalData?: unknown
}

export interface CatalogoActivo {
  idCatalogo: number
  cuentaId: number
  codigoCuenta: string
  nombreCuenta: string
}

/** Maps the backend tree to the format rc-tree expects (key=cuentaId). */
function mapApiTreeToRcTree(nodes?: CuentaNode[]): RCTreeNode[] {
  if (!nodes) return []
  return nodes.map((node) => ({
    key: node.cuentaId,
    title: `${node.codigoCuenta} - ${node.nombreCuenta}`,
    children: mapApiTreeToRcTree(node.children),
    isLeaf: !node.children || node.children.length === 0,
    // NOTE: intentionally NOT disabling non-movement nodes — every checkbox works
  }))
}

export const catalogService = {
  async getMasterTree(): Promise<RCTreeNode[]> {
    const resp = await apiClient.get<CuentaNode[]>('/cuentas-maestro/tree')
    // rename cuentaId -> key / nombreCuenta -> title for rc-tree
    return mapApiTreeToRcTree(resp.data)
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

/** Converts the flat list of active accounts into an rc-tree (key=idCatalogo). */
export function mapCompanyCatalogToTree(flatCatalog: CatalogoActivo[]): RCTreeNode[] {
  const nodesById = new Map<number, RCTreeNode>()
  const tree: RCTreeNode[] = []

  // first pass: one node per account, keyed by cuentaId
  for (const item of flatCatalog) {
    nodesById.set(item.cuentaId, {
      key: item.idCatalogo, // the KEY for deactivation is idCatalogo
      title: `${item.codigoCuenta} - ${item.nombreCuenta}`,
      children: [],
      originalData: item,
    })
  }

  // second pass: build the hierarchy
  for (const item of flatCatalog) {
    // parent code = code minus its last 2 chars (e.g. parent of "110101" is "1101")
    const parentCode = item.codigoCuenta.substring(0, item.codigoCuenta.length - 2)

    // look for a catalog item whose code matches the parent code
    const parentItem = flatCatalog.find((p) => p.codigoCuenta === parentCode)

    if (parentItem && nodesById.has(parentItem.cuentaId)) {
      nodesById.get(parentItem.cuentaId)!.children!.push(nodesById.get(item.cuentaId)!)
    } else {
      // no parent in this selection → root node
      tree.push(nodesById.get(item.cuentaId)!)
    }
  }

  // remove empty children arrays so rc-tree shows no expander
  const cleanEmptyChildren = (nodesToClean: RCTreeNode[]) => {
    for (const node of nodesToClean) {
      if (node.children && node.children.length > 0) {
        cleanEmptyChildren(node.children)
      } else {
        delete node.children
      }
    }
  }
  cleanEmptyChildren(tree)

  return tree
}
