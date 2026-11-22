// ================================================================
// Presupuesto maestro de operación y de caja — Módulo E (E1-E2).
//
// Fórmulas PURAS (sin Supabase ni I/O), igual que lib/ratioFormulas.ts del
// Módulo C: las usan la pantalla, el Excel, el resumen con IA, el script
// scripts/verify-presupuesto.mts y, más adelante, E3 (VAN/TIR).
//
// Empresa manufacturera, 12 meses. Orden de las cédulas:
//   1 Ventas → 2 Producción → 3 Materia prima y compras → 4 MOD → 5 CIF
//   → 6 Gastos de operación → 7 Presupuesto de caja (formato Gitman:
//   entradas, desembolsos, flujo neto, efectivo final, saldo mínimo,
//   financiamiento total requerido o saldo excedente).
// ================================================================

/** Clave del borrador de E1-E2 en localStorage (la lee también E3). */
export const CLAVE_BORRADOR_PRESUPUESTO = 'anf_presupuesto_borrador_v1'

export const MESES =['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const
export const N_MESES = 12

/** Lista de 12 valores, uno por mes (enero = índice 0). */
export type Mensual = number[]

export interface OtroDesembolso {
  concepto: string
  montos: Mensual
}

export interface SupuestosPresupuesto {
  anio: number
  ventas: {
    /** Unidades a vender por mes. */
    unidades: Mensual
    /** Unidades a vender en enero del año siguiente (para el inventario final de diciembre). */
    unidadesEneroSiguiente: number
    precioUnitario: number
    /** Ventas en $ de noviembre y diciembre del año anterior (cobros a 30 y 60 días de enero y febrero). */
    ventasNovAnterior: number
    ventasDicAnterior: number
  }
  inventarioProducto: {
    inicialUnidades: number
    /** % de las ventas del mes siguiente que se deja como inventario final. */
    porcentajeFinal: number
  }
  materiaPrima: {
    unidadesPorProducto: number
    costoUnitario: number
    inicialUnidades: number
    /** % de la materia prima que necesitará la producción del mes siguiente. */
    porcentajeFinal: number
  }
  manoObra: {
    horasPorUnidad: number
    tarifaHora: number
  }
  cif: {
    tasaVariablePorHora: number
    fijosMensuales: number
    /** Parte de los CIF fijos que es depreciación (no sale efectivo). */
    depreciacionMensual: number
  }
  gastosOperacion: {
    fijosMensuales: number
    /** % de las ventas en $ (comisiones, fletes...). */
    porcentajeVariable: number
  }
  cobros: {
    contado: number
    a30: number
    a60: number
    incobrable: number
  }
  pagosCompras: {
    contado: number
    a30: number
    a60: number
    comprasNovAnterior: number
    comprasDicAnterior: number
  }
  otrosDesembolsos: OtroDesembolso[]
  caja: {
    efectivoInicial: number
    saldoMinimo: number
  }
}

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------

export function redondear(valor: number, decimales = 2): number {
  const f = Math.pow(10, decimales)
  return Math.round((valor + Number.EPSILON) * f) / f
}

const r2 = (v: number) => redondear(v, 2)
const mensual = (fn: (m: number) => number): Mensual => Array.from({ length: N_MESES }, (_, m) => fn(m))
export const sumar = (lista: Mensual) => r2(lista.reduce((s, v) => s + v, 0))

/** Valor de la lista o 0 si está fuera de rango (evita índices calculados sin control). */
const en = (lista: Mensual, m: number) => (m >= 0 && m < lista.length ? lista.at(m) ?? 0 : 0)

// ---------------------------------------------------------------
// Validación de supuestos
// ---------------------------------------------------------------

export function validarSupuestos(s: SupuestosPresupuesto): string[] {
  const errores: string[] = []
  const pct = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100

  if (s.ventas.unidades.length !== N_MESES) errores.push('Las ventas deben tener 12 meses.')
  if (s.ventas.unidades.some((u) => !Number.isFinite(u) || u < 0)) {
    errores.push('Las unidades vendidas no pueden ser negativas.')
  }
  if (!(s.ventas.precioUnitario > 0)) errores.push('El precio unitario debe ser mayor que cero.')

  const sumaCobros = s.cobros.contado + s.cobros.a30 + s.cobros.a60 + s.cobros.incobrable
  if (![s.cobros.contado, s.cobros.a30, s.cobros.a60, s.cobros.incobrable].every(pct) || Math.abs(sumaCobros - 100) > 0.01) {
    errores.push(`Los porcentajes de cobro (contado, 30, 60 días e incobrable) deben sumar 100% (suman ${redondear(sumaCobros)}%).`)
  }
  const sumaPagos = s.pagosCompras.contado + s.pagosCompras.a30 + s.pagosCompras.a60
  if (![s.pagosCompras.contado, s.pagosCompras.a30, s.pagosCompras.a60].every(pct) || Math.abs(sumaPagos - 100) > 0.01) {
    errores.push(`Los porcentajes de pago de compras deben sumar 100% (suman ${redondear(sumaPagos)}%).`)
  }
  if (!pct(s.inventarioProducto.porcentajeFinal) || !pct(s.materiaPrima.porcentajeFinal)) {
    errores.push('Los porcentajes de inventario final deben estar entre 0 y 100.')
  }
  if (s.cif.depreciacionMensual > s.cif.fijosMensuales) {
    errores.push('La depreciación no puede ser mayor que los CIF fijos (es parte de ellos).')
  }
  for (const o of s.otrosDesembolsos) {
    if (o.montos.length !== N_MESES) errores.push(`"${o.concepto}" debe tener 12 meses.`)
  }
  const negativos = [
    s.ventas.unidadesEneroSiguiente,
    s.ventas.ventasNovAnterior,
    s.ventas.ventasDicAnterior,
    s.inventarioProducto.inicialUnidades,
    s.materiaPrima.unidadesPorProducto,
    s.materiaPrima.costoUnitario,
    s.materiaPrima.inicialUnidades,
    s.manoObra.horasPorUnidad,
    s.manoObra.tarifaHora,
    s.cif.tasaVariablePorHora,
    s.cif.fijosMensuales,
    s.cif.depreciacionMensual,
    s.gastosOperacion.fijosMensuales,
    s.gastosOperacion.porcentajeVariable,
    s.pagosCompras.comprasNovAnterior,
    s.pagosCompras.comprasDicAnterior,
    s.caja.saldoMinimo,
  ]
  if (negativos.some((v) => !Number.isFinite(v) || v < 0)) {
    errores.push('Los supuestos (costos, inventarios, tasas y montos del año anterior) no pueden ser negativos.')
  }
  return errores
}

// ---------------------------------------------------------------
// Cédulas 1 a 6
// ---------------------------------------------------------------

export interface CedulaVentas {
  unidades: Mensual
  precio: number
  importe: Mensual
}

export function cedulaVentas(s: SupuestosPresupuesto): CedulaVentas {
  const importe = mensual((m) => r2(en(s.ventas.unidades, m) * s.ventas.precioUnitario))
  return { unidades: [...s.ventas.unidades], precio: s.ventas.precioUnitario, importe }
}

export interface CedulaProduccion {
  ventas: Mensual
  inventarioFinal: Mensual
  totalNecesario: Mensual
  inventarioInicial: Mensual
  aProducir: Mensual
}

/** Unidades a producir = ventas + inventario final deseado − inventario inicial. */
export function cedulaProduccion(s: SupuestosPresupuesto): CedulaProduccion {
  const ventas = s.ventas.unidades
  const ventaSiguiente = (m: number) => (m === N_MESES - 1 ? s.ventas.unidadesEneroSiguiente : en(ventas, m + 1))
  const inventarioFinal: Mensual = []
  const inventarioInicial: Mensual = []
  const aProducir: Mensual = []
  for (let m = 0; m < N_MESES; m++) {
    const inicial = m === 0 ? s.inventarioProducto.inicialUnidades : inventarioFinal[m - 1]
    const deseado = r2(ventaSiguiente(m) * (s.inventarioProducto.porcentajeFinal / 100))
    const produccion = r2(Math.max(0, en(ventas, m) + deseado - inicial))
    inventarioInicial.push(inicial)
    aProducir.push(produccion)
    inventarioFinal.push(r2(inicial + produccion - en(ventas, m)))
  }
  const totalNecesario = mensual((m) => r2(en(ventas, m) + en(inventarioFinal, m)))
  return { ventas: [...ventas], inventarioFinal, totalNecesario, inventarioInicial, aProducir }
}

export interface CedulaMateriaPrima {
  aProducir: Mensual
  necesidad: Mensual
  inventarioFinal: Mensual
  totalNecesario: Mensual
  inventarioInicial: Mensual
  aComprar: Mensual
  costoUnitario: number
  compras: Mensual
}

/** Materia prima a comprar = necesidad + inventario final − inventario inicial; × costo. */
export function cedulaMateriaPrima(s: SupuestosPresupuesto, produccion: CedulaProduccion): CedulaMateriaPrima {
  const mpU = s.materiaPrima.unidadesPorProducto
  const necesidad = mensual((m) => r2(en(produccion.aProducir, m) * mpU))
  // Para diciembre se estima la producción de enero siguiente con sus ventas.
  const necesidadSiguiente = (m: number) =>
    m === N_MESES - 1 ? s.ventas.unidadesEneroSiguiente * mpU : en(necesidad, m + 1)
  const inventarioFinal: Mensual = []
  const inventarioInicial: Mensual = []
  const aComprar: Mensual = []
  for (let m = 0; m < N_MESES; m++) {
    const inicial = m === 0 ? s.materiaPrima.inicialUnidades : inventarioFinal[m - 1]
    const deseado = r2(necesidadSiguiente(m) * (s.materiaPrima.porcentajeFinal / 100))
    const compra = r2(Math.max(0, en(necesidad, m) + deseado - inicial))
    inventarioInicial.push(inicial)
    aComprar.push(compra)
    inventarioFinal.push(r2(inicial + compra - en(necesidad, m)))
  }
  const totalNecesario = mensual((m) => r2(en(necesidad, m) + en(inventarioFinal, m)))
  const compras = mensual((m) => r2(en(aComprar, m) * s.materiaPrima.costoUnitario))
  return {
    aProducir: [...produccion.aProducir],
    necesidad,
    inventarioFinal,
    totalNecesario,
    inventarioInicial,
    aComprar,
    costoUnitario: s.materiaPrima.costoUnitario,
    compras,
  }
}

export interface CedulaManoObra {
  aProducir: Mensual
  horas: Mensual
  tarifa: number
  costo: Mensual
}

/** MOD = unidades a producir × horas por unidad × tarifa por hora. */
export function cedulaManoObra(s: SupuestosPresupuesto, produccion: CedulaProduccion): CedulaManoObra {
  const horas = mensual((m) => r2(en(produccion.aProducir, m) * s.manoObra.horasPorUnidad))
  const costo = mensual((m) => r2(en(horas, m) * s.manoObra.tarifaHora))
  return { aProducir: [...produccion.aProducir], horas, tarifa: s.manoObra.tarifaHora, costo }
}

export interface CedulaCIF {
  horas: Mensual
  variables: Mensual
  fijos: Mensual
  total: Mensual
  depreciacion: Mensual
  efectivo: Mensual
}

/** CIF = tasa variable × horas MOD + fijos; el efectivo excluye la depreciación. */
export function cedulaCIF(s: SupuestosPresupuesto, mod: CedulaManoObra): CedulaCIF {
  const variables = mensual((m) => r2(en(mod.horas, m) * s.cif.tasaVariablePorHora))
  const fijos = mensual(() => r2(s.cif.fijosMensuales))
  const total = mensual((m) => r2(en(variables, m) + en(fijos, m)))
  const depreciacion = mensual(() => r2(s.cif.depreciacionMensual))
  const efectivo = mensual((m) => r2(en(total, m) - en(depreciacion, m)))
  return { horas: [...mod.horas], variables, fijos, total, depreciacion, efectivo }
}

export interface CedulaGastosOperacion {
  variables: Mensual
  fijos: Mensual
  total: Mensual
}

/** Gastos de venta y administración = fijos + % de las ventas. */
export function cedulaGastosOperacion(s: SupuestosPresupuesto, ventas: CedulaVentas): CedulaGastosOperacion {
  const variables = mensual((m) => r2(en(ventas.importe, m) * (s.gastosOperacion.porcentajeVariable / 100)))
  const fijos = mensual(() => r2(s.gastosOperacion.fijosMensuales))
  const total = mensual((m) => r2(en(variables, m) + en(fijos, m)))
  return { variables, fijos, total }
}

// ---------------------------------------------------------------
// Cédula 7: presupuesto de caja
// ---------------------------------------------------------------

export interface PresupuestoCaja {
  ventasContado: Mensual
  cobros30: Mensual
  cobros60: Mensual
  totalEntradas: Mensual
  pagoComprasContado: Mensual
  pagoCompras30: Mensual
  pagoCompras60: Mensual
  totalPagoCompras: Mensual
  manoObra: Mensual
  cif: Mensual
  gastosOperacion: Mensual
  otros: { concepto: string; montos: Mensual }[]
  totalDesembolsos: Mensual
  flujoNeto: Mensual
  efectivoInicial: Mensual
  efectivoFinal: Mensual
  saldoMinimo: Mensual
  financiamientoRequerido: Mensual
  saldoExcedente: Mensual
}

/**
 * Cobro (o pago) escalonado: lo del mes al contado, lo de hace 1 mes a 30
 * días y lo de hace 2 meses a 60 días. `anteriores` = [noviembre, diciembre]
 * del año anterior, para enero y febrero.
 */
function escalonado(montos: Mensual, anteriores: [number, number], pct: { contado: number; a30: number; a60: number }) {
  const mes = (m: number) => (m >= 0 ? en(montos, m) : m === -1 ? anteriores[1] : m === -2 ? anteriores[0] : 0)
  return {
    contado: mensual((m) => r2(mes(m) * (pct.contado / 100))),
    a30: mensual((m) => r2(mes(m - 1) * (pct.a30 / 100))),
    a60: mensual((m) => r2(mes(m - 2) * (pct.a60 / 100))),
  }
}

export function presupuestoCaja(
  s: SupuestosPresupuesto,
  ventas: CedulaVentas,
  materia: CedulaMateriaPrima,
  mod: CedulaManoObra,
  cif: CedulaCIF,
  gastos: CedulaGastosOperacion,
): PresupuestoCaja {
  const cobros = escalonado(ventas.importe, [s.ventas.ventasNovAnterior, s.ventas.ventasDicAnterior], s.cobros)
  const totalEntradas = mensual((m) => r2(en(cobros.contado, m) + en(cobros.a30, m) + en(cobros.a60, m)))

  const pagos = escalonado(
    materia.compras,
    [s.pagosCompras.comprasNovAnterior, s.pagosCompras.comprasDicAnterior],
    s.pagosCompras,
  )
  const totalPagoCompras = mensual((m) => r2(en(pagos.contado, m) + en(pagos.a30, m) + en(pagos.a60, m)))

  const otros = s.otrosDesembolsos.map((o) => ({ concepto: o.concepto, montos: mensual((m) => r2(en(o.montos, m))) }))
  const totalDesembolsos = mensual((m) =>
    r2(
      en(totalPagoCompras, m) +
        en(mod.costo, m) +
        en(cif.efectivo, m) +
        en(gastos.total, m) +
        otros.reduce((suma, o) => suma + en(o.montos, m), 0),
    ),
  )
  const flujoNeto = mensual((m) => r2(en(totalEntradas, m) - en(totalDesembolsos, m)))

  // El efectivo final de un mes es el inicial del siguiente (formato Gitman:
  // el financiamiento se informa, no se suma al efectivo).
  const efectivoInicial: Mensual = []
  const efectivoFinal: Mensual = []
  let saldo = s.caja.efectivoInicial
  for (let m = 0; m < N_MESES; m++) {
    efectivoInicial.push(r2(saldo))
    saldo = r2(saldo + en(flujoNeto, m))
    efectivoFinal.push(saldo)
  }

  const saldoMinimo = mensual(() => r2(s.caja.saldoMinimo))
  const financiamientoRequerido = mensual((m) => r2(Math.max(0, en(saldoMinimo, m) - en(efectivoFinal, m))))
  const saldoExcedente = mensual((m) => r2(Math.max(0, en(efectivoFinal, m) - en(saldoMinimo, m))))

  return {
    ventasContado: cobros.contado,
    cobros30: cobros.a30,
    cobros60: cobros.a60,
    totalEntradas,
    pagoComprasContado: pagos.contado,
    pagoCompras30: pagos.a30,
    pagoCompras60: pagos.a60,
    totalPagoCompras,
    manoObra: [...mod.costo],
    cif: [...cif.efectivo],
    gastosOperacion: [...gastos.total],
    otros,
    totalDesembolsos,
    flujoNeto,
    efectivoInicial,
    efectivoFinal,
    saldoMinimo,
    financiamientoRequerido,
    saldoExcedente,
  }
}

// ---------------------------------------------------------------
// Presupuesto completo
// ---------------------------------------------------------------

export interface PresupuestoMaestro {
  anio: number
  ventas: CedulaVentas
  produccion: CedulaProduccion
  materiaPrima: CedulaMateriaPrima
  manoObra: CedulaManoObra
  cif: CedulaCIF
  gastosOperacion: CedulaGastosOperacion
  caja: PresupuestoCaja
  resumen: {
    ventasAnuales: number
    entradasAnuales: number
    desembolsosAnuales: number
    flujoNetoAnual: number
    efectivoFinalAnual: number
    financiamientoMaximo: number
    /** Meses (0 = enero) en que el efectivo queda bajo el saldo mínimo. */
    mesesConFinanciamiento: number[]
  }
}

export function calcularPresupuesto(s: SupuestosPresupuesto): PresupuestoMaestro {
  const ventas = cedulaVentas(s)
  const produccion = cedulaProduccion(s)
  const materiaPrima = cedulaMateriaPrima(s, produccion)
  const manoObra = cedulaManoObra(s, produccion)
  const cif = cedulaCIF(s, manoObra)
  const gastosOperacion = cedulaGastosOperacion(s, ventas)
  const caja = presupuestoCaja(s, ventas, materiaPrima, manoObra, cif, gastosOperacion)

  const mesesConFinanciamiento = caja.financiamientoRequerido
    .map((v, m) => (v > 0 ? m : -1))
    .filter((m) => m >= 0)

  return {
    anio: s.anio,
    ventas,
    produccion,
    materiaPrima,
    manoObra,
    cif,
    gastosOperacion,
    caja,
    resumen: {
      ventasAnuales: sumar(ventas.importe),
      entradasAnuales: sumar(caja.totalEntradas),
      desembolsosAnuales: sumar(caja.totalDesembolsos),
      flujoNetoAnual: sumar(caja.flujoNeto),
      efectivoFinalAnual: caja.efectivoFinal.at(-1) ?? 0,
      financiamientoMaximo: Math.max(0, ...caja.financiamientoRequerido),
      mesesConFinanciamiento,
    },
  }
}

// ---------------------------------------------------------------
// Propuesta de ventas a partir del histórico anual
// ---------------------------------------------------------------

/** Crecimiento anual compuesto entre el primer y el último año (en %). */
export function crecimientoPromedio(historico: { anio: number; monto: number }[]): number {
  const ordenado = [...historico].filter((h) => h.monto > 0).sort((a, b) => a.anio - b.anio)
  if (ordenado.length < 2) return 0
  const primero = ordenado[0]
  const ultimo = ordenado.at(-1)!
  const anios = ultimo.anio - primero.anio
  if (anios <= 0) return 0
  return redondear((Math.pow(ultimo.monto / primero.monto, 1 / anios) - 1) * 100, 2)
}

/**
 * Reparte las ventas anuales propuestas en 12 meses según los pesos de
 * estacionalidad (en %, deben sumar 100) y las convierte en unidades.
 */
export function proponerUnidades(ventasAnuales: number, precioUnitario: number, pesos: Mensual): Mensual {
  if (!(precioUnitario > 0)) return mensual(() => 0)
  const sumaPesos = pesos.reduce((s, p) => s + p, 0) || 1
  return mensual((m) => Math.round((ventasAnuales * (en(pesos, m) / sumaPesos)) / precioUnitario))
}

/** Supuestos de ejemplo para empezar (empresa manufacturera pequeña). */
export function supuestosEjemplo(anio: number): SupuestosPresupuesto {
  return {
    anio,
    ventas: {
      unidades: [1000, 1100, 1200, 1300, 1250, 1200, 1300, 1400, 1500, 1600, 1800, 2000],
      unidadesEneroSiguiente: 1100,
      precioUnitario: 25,
      ventasNovAnterior: 22_000,
      ventasDicAnterior: 24_000,
    },
    inventarioProducto: { inicialUnidades: 200, porcentajeFinal: 20 },
    materiaPrima: { unidadesPorProducto: 2, costoUnitario: 3, inicialUnidades: 500, porcentajeFinal: 25 },
    manoObra: { horasPorUnidad: 0.5, tarifaHora: 4 },
    cif: { tasaVariablePorHora: 2, fijosMensuales: 3_000, depreciacionMensual: 800 },
    gastosOperacion: { fijosMensuales: 4_000, porcentajeVariable: 5 },
    cobros: { contado: 40, a30: 40, a60: 18, incobrable: 2 },
    pagosCompras: { contado: 50, a30: 50, a60: 0, comprasNovAnterior: 6_000, comprasDicAnterior: 6_500 },
    otrosDesembolsos: [
      { concepto: 'Pago de impuestos', montos: [0, 0, 0, 3_000, 0, 0, 0, 0, 0, 0, 0, 0] },
      { concepto: 'Compra de maquinaria', montos: [0, 0, 0, 0, 0, 12_000, 0, 0, 0, 0, 0, 0] },
    ],
    caja: { efectivoInicial: 5_000, saldoMinimo: 4_000 },
  }
}
