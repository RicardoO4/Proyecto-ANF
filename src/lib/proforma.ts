import { REBAJAS_DEVOLUCIONES } from '@/lib/accountCodes'
import type { BaseFinanciera } from '@/lib/baseFinanciera'
export interface SupuestosProforma { ventasProyectadas: number; retencion: number; porcentajeVariableGastos: number }
export function generarProforma(base: BaseFinanciera, supuestos: SupuestosProforma) {
  if (base.periodo && !base.periodo.completo) throw new Error('La proyección anual requiere un año base completo. Puede analizar este ejercicio en ANF como preliminar.')
  if (!base.tieneBalance || !base.tieneResultados || !(base.ventas > 0)) throw new Error('Se necesitan Balance General y Estado de Resultados con ventas netas positivas.')
  if (!Object.values(supuestos).every(Number.isFinite) || supuestos.ventasProyectadas <= 0 || supuestos.retencion < 0 || supuestos.retencion > 100 || supuestos.porcentajeVariableGastos < 0 || supuestos.porcentajeVariableGastos > 100) throw new Error('Ventas positivas y porcentajes entre 0 y 100 son obligatorios.')
  if (Math.abs(base.activos - base.pasivos - base.patrimonio) > 0.05) throw new Error('El balance de origen no cuadra. Corrija la carga antes de proyectar.')
  const factor = supuestos.ventasProyectadas / base.ventas
  const resultados = base.resultados.map(l => {
    const variable = l.codigo.startsWith('5') || l.codigo.startsWith('4101') ? 1 : l.codigo.startsWith('4102') || l.codigo.startsWith('4103') ? supuestos.porcentajeVariableGastos / 100 : 0
    return { ...l, fijo: l.saldo * (1 - variable), variable: l.saldo * variable, proyectado: l.saldo * ((1 - variable) + variable * factor) }
  })
  const sumar = (lista: { codigo: string; proyectado: number }[], prefijo: string) => lista.filter(l => l.codigo.startsWith(prefijo)).reduce((s, l) => s + l.proyectado, 0)
  const ingresos = sumar(resultados, '5') - 2 * sumar(resultados, REBAJAS_DEVOLUCIONES), gastos = sumar(resultados, '4'), utilidad = ingresos - gastos
  const retenida = utilidad < 0 ? utilidad : utilidad * supuestos.retencion / 100
  const balance = base.balance.map(l => ({ ...l, proyectado: l.saldo * ((l.codigo.startsWith('11') && !l.codigo.startsWith('1101')) || l.codigo.startsWith('2102') ? factor : 1) }))
  const activosAntesFinanciar = sumar(balance, '1'), pasivosAntesFinanciar = sumar(balance, '2')
  const patrimonio = base.patrimonio + retenida
  const fer = activosAntesFinanciar - pasivosAntesFinanciar - patrimonio
  const financiamiento = Math.max(0, fer), excesoCaja = Math.max(0, -fer)
  const activos = activosAntesFinanciar + excesoCaja, pasivos = pasivosAntesFinanciar + financiamiento
  return { anio: base.anio + 1, resultados, balance, ingresos, gastos, utilidad, retenida, fer, financiamiento, excesoCaja, activos, pasivos, patrimonio, diferencia: activos - pasivos - patrimonio }
}
