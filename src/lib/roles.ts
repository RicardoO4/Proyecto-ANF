// Compartido por navegación y autorización; la API siempre comprueba el rol real.
export const ROLES = ['ADMIN', 'CONTADOR', 'ANALISTA'] as const
export const NOMBRES_ROLES: Record<string,string> = {ADMIN:'Administrador',CONTADOR:'Contador',ANALISTA:'Analista financiero'}
export function inicioDeUsuario(usuario: {rol:string;accesos:number[]}) {
  return usuario.rol==='CONTADOR' ? '/contabilidad' : '/dashboard'
}
export function rutaPermitidaPorRol(path:string,rol:string,api=false) {
  if(rol==='CONTADOR')return api
    ? path==='/api/v1/empresas/principal'||path==='/api/v1/contabilidad'||path.startsWith('/api/v1/contabilidad/')
    : path==='/contabilidad'||path.startsWith('/contabilidad/')
  if(rol==='ANALISTA')return api
    ? path!=='/api/v1/contabilidad'&&!path.startsWith('/api/v1/contabilidad/')
    : path!=='/contabilidad'&&!path.startsWith('/contabilidad/')
  return rol==='ADMIN'
}
