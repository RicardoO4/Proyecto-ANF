// 1. Importa los nuevos íconos al principio del archivo
import {
  House,
  Building,
  PeopleFill,
  Diagram3,
  BarChart,
  FileEarmarkText,
  JournalCheck,
  GraphUpArrow,
} from 'react-bootstrap-icons'
import type { Icon as IconType } from 'react-bootstrap-icons'

// Solo necesitamos una lista de enlaces, ya que no hay roles
export const mainLinks: { idOp: number; to: string; label: string; icon: IconType }[] = [
  { idOp: 0, to: '/dashboard', label: 'Dashboard', icon: House },
  { idOp: 1, to: '/empresas', label: 'Empresas', icon: Building },
  { idOp: 2, to: '/analisis', label: 'Análisis y Reportes', icon: BarChart },
  { idOp: 3, to: '/ratios', label: 'Ratios', icon: Diagram3 },
  { idOp: 4, to: '/usuarios', label: 'Usuarios', icon: PeopleFill },
  { idOp: 5, to: '/catalogo-cuentas', label: 'Catálogo de Cuentas', icon: JournalCheck },
  { idOp: 6, to: '/proyecciones', label: 'Proyecciones', icon: GraphUpArrow },
  { idOp: 7, to: '/estados-financieros', label: 'Estados Financieros', icon: FileEarmarkText },
]

/**
 * Configuraciones centralizadas para los sub-menús de cada módulo.
 */

export const empresasSubMenuLinks = [
  { to: '/empresas', label: 'Ver Empresas' },
  { to: '/empresas/nuevo', label: 'Registrar Empresa' },
  { to: '/empresas/inactivas', label: 'Ver Inactivas' },
]

export const sectoresSubMenuLinks = [
  { to: '/ratios', label: 'Ratio' },
  { to: '/categoria_ratio', label: 'Categoria' },
  { to: '/tipo_ratio', label: 'Tipo' },
  { to: '/parametro_sector', label: 'Parametro' },
  { to: '/sectores', label: 'Sector' },
]

export const usuariosSubMenuLinks = [
  { to: '/usuarios', label: 'Ver Usuarios' },
  { to: '/usuarios/nuevo', label: 'Registrar Usuario' },
]

/**
 * Enlaces para el submenú del módulo de Catálogo de Cuentas.
 * Este flujo es más específico.
 */
export const catalogoCuentasSubMenuLinks = [
  { to: '/catalogo-cuentas', label: 'Gestión por Empresa' },
  { to: '/catalogo-cuentas/maestro', label: 'Ver Catálogo Maestro' },
]

/**
 * Enlaces para el submenú del módulo de Proyecciones.
 * Orientado a la creación y visualización de análisis.
 */
export const proyeccionesSubMenuLinks = [
  { to: '/proyecciones/cargar', label: 'Cargar Ventas Históricas' },
  { to: '/proyecciones/historial', label: 'Ver Historial de Ventas' },
]

/**
 * Enlaces para el submenú del módulo de Estados Financieros.
 * Enfocado en la carga de datos y la visualización de reportes.
 */
export const estadosFinancierosSubMenuLinks = [
  { to: '/estados-financieros/cargar', label: 'Cargar Nuevo Reporte' },
  { to: '/estados-financieros/historial', label: 'Historial de Reportes' },
]
