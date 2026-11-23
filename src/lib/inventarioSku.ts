const PREFIJO_SKU = 'INV-'

export function siguienteCodigoSku(codigos: string[]): string {
  let maximo = 0
  for (const codigo of codigos) {
    const coincidencia = /^INV-(\d+)$/.exec(String(codigo).trim())
    if (!coincidencia) continue
    maximo = Math.max(maximo, Number(coincidencia[1]))
  }
  return `${PREFIJO_SKU}${String(maximo + 1).padStart(3, '0')}`
}
