const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function buscarCuentas<T extends { codigo: string; nombre: string }>(cuentas: T[], busqueda: string): T[] {
  const terminos = normalizar(busqueda).trim().split(/\s+/).filter(Boolean)
  return cuentas.filter(cuenta => {
    const texto = normalizar(`${cuenta.codigo} ${cuenta.nombre}`)
    return terminos.every(termino => texto.includes(termino))
  })
}
