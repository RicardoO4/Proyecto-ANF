import { REBAJAS_DEVOLUCIONES, VENTAS_BRUTAS } from '@/lib/accountCodes'
import type { BaseFinanciera } from '@/lib/baseFinanciera'

export interface SupuestosProforma {
  ventasProyectadas: number
  retencion: number
  porcentajeVariableGastos: number
  tasaImpuesto?: number
  tasaInteresFinanciamiento?: number
  codigoImpuesto?: string
  porcentajesVariablesBalance?: Record<string, number>
  porcentajesVariablesResultados?: Record<string, number>
}

export function porcentajeVariableProforma(codigo: string, tipo: 'balance' | 'resultados', gastosVariables = 0) {
  if (tipo === 'balance') return ((codigo.startsWith('11') && !codigo.startsWith('1101')) || codigo.startsWith('2102')) ? 100 : 0
  if (codigo.startsWith('5') || codigo.startsWith('4101')) return 100
  return codigo.startsWith('4102') || codigo.startsWith('4103') ? gastosVariables : 0
}

function validarPorcentajes(valores: Record<string, number> | undefined, codigos: Set<string>) {
  if (valores === undefined) return
  if (!valores || typeof valores !== 'object' || Array.isArray(valores) || Object.entries(valores).some(([codigo, valor]) =>
    !codigos.has(codigo) || typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 100,
  )) throw new Error('Los supuestos por cuenta deben usar códigos existentes y porcentajes entre 0 y 100.')
}

export function generarProforma(base: BaseFinanciera, supuestos: SupuestosProforma) {
  if (base.periodo && !base.periodo.completo) throw new Error('La proyección anual requiere un año base completo. Puede analizar este ejercicio en ANF como preliminar.')
  if (!base.tieneBalance || !base.tieneResultados || !(base.ventas > 0)) throw new Error('Se necesitan Balance General y Estado de Resultados con ventas netas positivas.')
  const tasaImpuesto = supuestos.tasaImpuesto === undefined ? 0 : supuestos.tasaImpuesto
  const tasaInteres = supuestos.tasaInteresFinanciamiento === undefined ? 0 : supuestos.tasaInteresFinanciamiento
  const codigoImpuesto = supuestos.codigoImpuesto === undefined ? '' : supuestos.codigoImpuesto
  if (![supuestos.ventasProyectadas, supuestos.retencion, supuestos.porcentajeVariableGastos, tasaImpuesto, tasaInteres].every(v => typeof v === 'number' && Number.isFinite(v)) ||
    supuestos.ventasProyectadas <= 0 || supuestos.retencion < 0 || supuestos.retencion > 100 ||
    supuestos.porcentajeVariableGastos < 0 || supuestos.porcentajeVariableGastos > 100 ||
    tasaImpuesto < 0 || tasaImpuesto > 100 || tasaInteres < 0 || tasaInteres >= 100) {
    throw new Error('Ventas positivas; retención, gastos variables e impuesto entre 0 y 100; interés entre 0 y menos de 100 %.')
  }
  if (typeof codigoImpuesto !== 'string' || (codigoImpuesto && !base.resultados.some(l => l.codigo === codigoImpuesto && l.codigo.startsWith('4')))) {
    throw new Error('Seleccione una cuenta de gasto existente para sustituir el impuesto del año base.')
  }
  if (tasaImpuesto > 0 && !codigoImpuesto && base.resultados.some(l => l.codigo.startsWith('4') && /impuesto.*renta|renta.*impuesto|\bisr\b/i.test(l.nombre))) {
    throw new Error('El estado base contiene una cuenta de impuesto sobre la renta. Selecciónela para sustituirla y evitar duplicar el impuesto.')
  }
  validarPorcentajes(supuestos.porcentajesVariablesBalance, new Set(base.balance.map(l => l.codigo)))
  validarPorcentajes(supuestos.porcentajesVariablesResultados, new Set(base.resultados.map(l => l.codigo)))
  if (Object.entries(supuestos.porcentajesVariablesResultados ?? {}).some(([codigo, porcentaje]) =>
    (codigo.startsWith(VENTAS_BRUTAS) || codigo.startsWith(REBAJAS_DEVOLUCIONES)) && porcentaje !== 100,
  )) throw new Error('Las ventas y sus devoluciones deben seguir la meta de ventas proyectadas (100 % variable).')
  if (![base.ventas, base.activos, base.pasivos, base.patrimonio, ...base.balance.map(l => l.saldo), ...base.resultados.map(l => l.saldo)].every(Number.isFinite)) throw new Error('Los estados base deben contener importes finitos.')
  if (Math.abs(base.activos - base.pasivos - base.patrimonio) > 0.05) throw new Error('El balance de origen no cuadra. Corrija la carga antes de proyectar.')

  const factor = supuestos.ventasProyectadas / base.ventas
  const proyectar = (l: { codigo: string; nombre: string; saldo: number }, tipo: 'balance' | 'resultados') => {
    const ajustes = tipo === 'balance' ? supuestos.porcentajesVariablesBalance : supuestos.porcentajesVariablesResultados
    const porcentajeVariable = ajustes?.[l.codigo] ?? porcentajeVariableProforma(l.codigo, tipo, supuestos.porcentajeVariableGastos)
    const variable = l.saldo * porcentajeVariable / 100
    const fijo = l.saldo - variable
    return { ...l, porcentajeVariable, fijo, variable, proyectado: fijo + variable * factor }
  }
  const resultadosAntes = base.resultados.map(l => proyectar(l, 'resultados'))
  const sumar = (lista: { codigo: string; proyectado: number }[], prefijo: string) => lista.filter(l => l.codigo.startsWith(prefijo)).reduce((s, l) => s + l.proyectado, 0)
  const ingresos = sumar(resultadosAntes, '5') - 2 * sumar(resultadosAntes, REBAJAS_DEVOLUCIONES)
  // Sustituir el impuesto base identificado evita gravar dos veces el mismo concepto.
  const gastosAntesImpuestoInteres = resultadosAntes.filter(l => l.codigo !== codigoImpuesto && l.codigo.startsWith('4')).reduce((s, l) => s + l.proyectado, 0)
  const utilidadAntesInteresNuevo = ingresos - gastosAntesImpuestoInteres
  const balance = base.balance.map(l => proyectar(l, 'balance'))
  const activosAntesFinanciar = sumar(balance, '1')
  const pasivosAntesFinanciar = sumar(balance, '2')
  const patrimonioBaseProyectado = sumar(balance, '3')
  const necesidadAntesResultados = activosAntesFinanciar - pasivosAntesFinanciar - patrimonioBaseProyectado
  const t = tasaImpuesto / 100, r = tasaInteres / 100, k = supuestos.retencion / 100
  const calcularResultado = (deuda: number) => {
    const interesesNuevos = deuda * r
    const utilidadAntesImpuestos = utilidadAntesInteresNuevo - interesesNuevos
    const impuesto = Math.max(0, utilidadAntesImpuestos) * t
    const utilidad = utilidadAntesImpuestos - impuesto
    const retenida = utilidad < 0 ? utilidad : utilidad * k
    return { interesesNuevos, utilidadAntesImpuestos, impuesto, utilidad, retenida }
  }
  const sinInteres = calcularResultado(0)
  const ferAntesIntereses = necesidadAntesResultados - sinInteres.retenida
  let deuda = 0
  if (ferAntesIntereses > 0) {
    // Resolver simultáneamente deuda, intereses, impuesto y retención, incluida
    // la transición a pérdida (sin impuesto ni aplicación parcial de pérdidas).
    const retencionNeta = k * (1 - t)
    const candidato = (necesidadAntesResultados - retencionNeta * utilidadAntesInteresNuevo) / (1 - retencionNeta * r)
    deuda = utilidadAntesInteresNuevo - candidato * r >= 0
      ? candidato
      : (necesidadAntesResultados - utilidadAntesInteresNuevo) / (1 - r)
  }
  const resultado = calcularResultado(deuda)
  const fer = necesidadAntesResultados - resultado.retenida
  const financiamiento = Math.max(0, fer), excesoCaja = Math.max(0, -fer)
  const resultados = resultadosAntes.map(l => l.codigo === codigoImpuesto
    ? { ...l, fijo: 0, variable: 0, proyectado: resultado.impuesto, impuestoCalculado: true }
    : { ...l, impuestoCalculado: false })
  const gastos = gastosAntesImpuestoInteres + resultado.interesesNuevos + resultado.impuesto
  const patrimonio = patrimonioBaseProyectado + resultado.retenida
  const activos = activosAntesFinanciar + excesoCaja, pasivos = pasivosAntesFinanciar + financiamiento
  const diferencia = activos - pasivos - patrimonio
  if (![factor, ingresos, gastos, activos, pasivos, patrimonio, fer, resultado.impuesto, resultado.interesesNuevos].every(Number.isFinite)) {
    throw new Error('Los supuestos generan importes fuera del rango calculable. Revise crecimiento y tasas.')
  }
  return {
    anio: base.anio + 1, resultados, balance, ingresos, gastos, ...resultado,
    dividendos: resultado.utilidad > 0 ? resultado.utilidad - resultado.retenida : 0,
    fer, ferAntesIntereses, financiamiento, excesoCaja, activos, pasivos, patrimonio,
    activosAntesFinanciar, pasivosAntesFinanciar, patrimonioBaseProyectado,
    gastosAntesImpuestoInteres, tasaImpuesto, tasaInteresFinanciamiento: tasaInteres, codigoImpuesto,
    diferencia: Math.abs(diferencia) < 1e-7 ? 0 : diferencia,
  }
}
