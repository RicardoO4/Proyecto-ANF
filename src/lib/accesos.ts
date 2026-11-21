import { rutaPermitidaPorRol } from './roles'
export function opcionDePagina(path: string): number | null {
  if(path==='/contabilidad/accesos'||path.startsWith('/contabilidad/accesos/'))return 4
  const rutas: Record<string, number> = { empresas: 1, analisis: 2, ratios: 3, inventarios: 3, categoria_ratio: 3, tipo_ratio: 3, parametro_sector: 3, sectores: 3, usuarios: 4, 'catalogo-cuentas': 5, proyecciones: 6, 'estados-financieros': 7 }
  return path.split('/')[1] === 'contabilidad' ? 8 : rutas[path.split('/')[1]] ?? null
}
export function puedeVerPagina(path: string, usuario: { rol: string; accesos: number[] }): boolean {
  const opcion = opcionDePagina(path)
  if(path==='/contabilidad/accesos'||path.startsWith('/contabilidad/accesos/'))return usuario.rol==='ADMIN'
  return rutaPermitidaPorRol(path,usuario.rol)&&(usuario.rol === 'ADMIN' || opcion === null || usuario.accesos.includes(opcion))
}
