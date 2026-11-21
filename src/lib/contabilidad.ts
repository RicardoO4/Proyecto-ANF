// Contratos y cálculos de presentación. La contabilización y el cierre se validan en PostgreSQL.
export interface CuentaContable { id: number; codigo: string; nombre: string; tipo: string; imputable: boolean; activa: boolean }
export interface PeriodoContable { id: number; anio: number; origen: 'HISTORICO' | 'CONTABILIDAD'; estado: 'ABIERTO' | 'REVISION' | 'CERRADO'; version: number; version_publicada: number | null; periodo_base: number | null }
export interface LineaPartida { id?: number; cuenta_id: number; codigo: string; nombre: string; debe: number; haber: number }
export interface PartidaContable { id: number; numero: number; fecha: string; descripcion: string; tipo: string; estado: string; autor: string; reversa_de: number | null; lineas: LineaPartida[] }
export interface SaldoContable { cuenta_id: number; codigo: string; nombre: string; debe: number | null; haber: number | null; sin_ajustes: number; ajuste: number; saldo: number }
export interface LineaEstadoContable { cuentaId: number; codigo: string; nombre: string; saldo: number }
export interface EstadosContables { balance: LineaEstadoContable[]; resultados: LineaEstadoContable[]; utilidad: number; ventas: number; version: number; error?: string }
export interface BaseContable {
  periodos: PeriodoContable[]; cuentas: CuentaContable[]; partidas: PartidaContable[]; saldos: SaldoContable[];
  estados: EstadosContables | null; apertura: { codigo: string; saldo: number }[];
  publicaciones: { id: number; version: number; creado_en: string; estados: EstadosContables }[];
  auditoria: { id: number; accion: string; usuario_id: number; creado_en: string; detalle: { motivo?: string; partidaId?: number } }[];
}
/** Importes en centavos: evita tolerancias que permitan partidas desbalanceadas. */
export function centavos(value: string | number): number {
  const text = String(value).trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error('Ingrese un importe con un máximo de dos decimales.')
  const [whole, decimals = ''] = text.replace('-', '').split('.')
  const amount = Number(whole) * 100 + Number(decimals.padEnd(2, '0'))
  if (!Number.isSafeInteger(amount) || amount > 999_999_999_999_999) throw new Error('El importe excede la precisión admitida.')
  return text.startsWith('-') ? -amount : amount
}
export function validarPartida(lineas: { cuentaId: number; debe: string | number; haber: string | number }[]) {
  if (lineas.length < 2 || lineas.length > 500) throw new Error('Ingrese entre dos y 500 líneas.')
  let debe = 0, haber = 0
  for (const l of lineas) {
    const d = centavos(l.debe), h = centavos(l.haber)
    if (!Number.isInteger(l.cuentaId) || l.cuentaId <= 0 || d < 0 || h < 0 || (d > 0) === (h > 0)) throw new Error('Cada línea necesita una cuenta y un importe en Debe o Haber.')
    debe += d; haber += h
  }
  if (!Number.isSafeInteger(debe) || !Number.isSafeInteger(haber)) throw new Error('La partida excede la precisión admitida.')
  return { debe: debe / 100, haber: haber / 100, diferencia: (debe - haber) / 100 }
}
export function resumenContable(base: BaseContable) {
  const sum = (items: { codigo: string; saldo: number }[], prefix: string) => items.filter(l => l.codigo.startsWith(prefix)).reduce((n,l) => n + centavos(l.saldo), 0)
  const balance = base.estados?.balance ?? []
  const activos = sum(balance, '1'), pasivos = sum(balance, '2'), patrimonio = sum(balance, '3')
  const inicial = sum(base.apertura, '3')
  const movimientos = base.saldos.filter(l => l.codigo.startsWith('3')).reduce((n,l) => n - centavos(l.saldo), 0) - inicial
  const utilidad = centavos(base.estados?.utilidad ?? 0)
  return { activos: activos/100, pasivos: pasivos/100, patrimonio: patrimonio/100, utilidad: utilidad/100, inicial: inicial/100, movimientos: movimientos/100,
    patrimonioFinal: (inicial + movimientos + utilidad) / 100,
    diferencia: (activos - pasivos - patrimonio) / 100 }
}
export function mayorContable(partidas: PartidaContable[], cuentaId: number) {
  let saldo = 0
  return partidas.filter(a => a.estado === 'CONTABILIZADO').toSorted((a,b) => a.fecha.localeCompare(b.fecha) || a.numero-b.numero)
    .flatMap(a => a.lineas.filter(l => l.cuenta_id === cuentaId).map(l => {
      saldo += centavos(l.debe) - centavos(l.haber)
      return { partida: a.numero, fecha: a.fecha, concepto: a.descripcion, tipo: a.tipo, debe: l.debe, haber: l.haber, saldo: saldo / 100 }
    }))
}
export function balancePostcierre(partidas: PartidaContable[]) {
  const map = new Map<number, { codigo: string; nombre: string; saldo: number }>()
  for (const a of partidas.filter(a => a.estado === 'CONTABILIZADO')) for (const l of a.lineas) {
    const row = map.get(l.cuenta_id) ?? { codigo: l.codigo, nombre: l.nombre, saldo: 0 }
    row.saldo += centavos(l.debe) - centavos(l.haber); map.set(l.cuenta_id, row)
  }
  return [...map.values()].filter(l => l.saldo !== 0).map(l => ({ ...l, saldo: l.saldo / 100 })).sort((a,b) => a.codigo.localeCompare(b.codigo))
}
