const formateador = new Intl.NumberFormat('es-SV', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const aNumero = (valor: number | string | null | undefined): number | null => {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : null
}

export const formatMoney = (valor: number | string | null | undefined): string => {
  const numero = aNumero(valor)
  return numero === null ? '—' : formateador.format(numero)
}

export const formatSignedMoney = (
  valor: number | string | null | undefined,
  signoPositivo = '+',
): string => {
  const numero = aNumero(valor)
  if (numero === null) return '—'
  const signo = numero > 0 ? signoPositivo : numero < 0 ? '-' : ''
  return `${signo}${formateador.format(Math.abs(numero))}`
}
