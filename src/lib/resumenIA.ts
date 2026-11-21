import { REBAJAS_DEVOLUCIONES } from '@/lib/accountCodes'
import { pronosticarVentas } from '@/lib/pronosticos'
import { obtenerVentasProyeccion } from './ventasProyeccionServidor'
import { obtenerPeriodosFinancieros } from './periodosFinancierosServidor'
import { describirPeriodo } from './periodoFinanciero'
import { obtenerBaseFinanciera } from '@/lib/baseFinanciera'
import { getEmpresaPrincipal } from '@/lib/empresaPrincipal'
import { generarProforma } from '@/lib/proforma'
// Resumen con IA de cada análisis (Módulo E).
//
// Cada pantalla de análisis envía su tipo y sus parámetros. El servidor
// VUELVE A CALCULAR los datos con las mismas funciones que usa la pantalla
// (no confía en números enviados por el navegador), arma un mensaje
// compacto —para ahorrar tokens de la versión gratuita— y pide a Gemini la
// explicación. Solo lee la base de datos; nunca envía el nombre de la empresa.
import { supabaseAdmin } from '@/lib/supabase/admin'
import { BadRequestException, NotFoundException } from '@/lib/errors'
import { generarReporteInterno, calcularEvolucionRatios } from '@/lib/analisis'
import { calcularProyeccion, proyeccionLogaritmica, proyeccionPromedioMovil } from '@/lib/proyeccion'
import { interpretarRatios } from '@/lib/asistenteFinanciero'
import { MESES, calcularPresupuesto, validarSupuestos, type SupuestosPresupuesto } from '@/lib/presupuesto'
import { compararProyectos, validarCapital, type SupuestosCapital } from '@/lib/capital'
import { dinero, interpretarConCache, num, pct, type InterpretacionIA, type MetaIA } from '@/lib/iaComun'
import type { LineaAnalisisDTO, MetodoProyeccion, VentaRow } from '@/types'

export const TIPOS_RESUMEN = [
  'comparativo',
  'ratios',
  'evolucion',
  'equilibrio',
  'dupont',
  'proyeccion',
  'pronostico',
  'proforma',
  'presupuesto',
  'capital',
] as const

export type TipoResumen = (typeof TIPOS_RESUMEN)[number]

export interface ResumenIARespuesta extends MetaIA {
  tipo: TipoResumen
  titulo: string
  /** Datos que recibió la IA, para que el usuario los compare con la pantalla. */
  datosClave: { etiqueta: string; valor: string }[]
  interpretacion: InterpretacionIA
}

type Datos = Record<string, unknown>

interface Preparado {
  titulo: string
  clave: string
  mensaje: string
  datosClave: { etiqueta: string; valor: string }[]
}

// ---------------------------------------------------------------
// Validación de entradas
// ---------------------------------------------------------------

function numero(d: Datos, campo: string, opciones: { min?: number; entero?: boolean } = {}): number {
  const v = Number(d[campo])
  const valido =
    Number.isFinite(v) &&
    (opciones.min === undefined || v >= opciones.min) &&
    (!opciones.entero || Number.isInteger(v))
  if (!valido) {
    throw new BadRequestException(`El dato '${campo}' es obligatorio y debe ser un número válido.`)
  }
  return v
}

function listaNumeros(d: Datos, campo: string, min: number, max: number): number[] {
  const v = d[campo]
  if (!Array.isArray(v) || v.length < min || v.length > max || !v.every((x) => Number.isFinite(Number(x)))) {
    throw new BadRequestException(`'${campo}' debe ser una lista de ${min} a ${max} números.`)
  }
  return v.map(Number)
}

// ---------------------------------------------------------------
// Un preparador por tipo de análisis
// ---------------------------------------------------------------

async function comparativo(d: Datos): Promise<Preparado> {
  const empresaId = numero(d, 'empresaId', { min: 1, entero: true })
  const anio1 = numero(d, 'anio1', { min: 1900, entero: true })
  const anio2 = numero(d, 'anio2', { min: 1900, entero: true })
  const rep = await generarReporteInterno(empresaId, anio1, anio2)
  const periodosContables = await obtenerPeriodosFinancieros(empresaId)
  const periodos = [anio1,anio2].map(anio => describirPeriodo(anio,periodosContables.find(p => p.anio === anio)))
  if (rep.analisisHorizontal.length === 0) {
    throw new NotFoundException(`No hay estados financieros de ${anio1} y ${anio2} para comparar.`)
  }

  const lineas = rep.analisisHorizontal
  const suma = (pref: string, anio: 1 | 2) =>
    lineas
      .filter((l) => l.codigoCuenta.startsWith(pref))
      .reduce((s, l) => s + (anio === 1 ? l.saldoAnio1 : l.saldoAnio2), 0)
  const total = (pref: string, nombre: string) =>
    `${nombre}: ${dinero(suma(pref, 1))} → ${dinero(suma(pref, 2))}`

  // Solo las cuentas con los cambios más grandes (ahorro de tokens)
  const top = (filtro: (l: LineaAnalisisDTO) => boolean, n: number) =>
    lineas
      .filter((l) => filtro(l) && l.variacionAbsoluta !== 0)
      .sort((a, b) => Math.abs(b.variacionAbsoluta) - Math.abs(a.variacionAbsoluta))
      .slice(0, n)
      .map(
        (l) =>
          `- ${l.nombreCuenta}: ${dinero(l.saldoAnio1)} → ${dinero(l.saldoAnio2)} (${l.variacionAbsoluta >= 0 ? '+' : ''}${dinero(l.variacionAbsoluta)}, ${pct(l.variacionRelativa)}; pesa ${pct(l.porcentajeVerticalAnio2)} en ${anio2})`,
      )
  const esBalance = (l: LineaAnalisisDTO) => (l.tipoReporte ?? 'BALANCE_GENERAL') === 'BALANCE_GENERAL'
  const esResultados = (l: LineaAnalisisDTO) => l.tipoReporte === 'ESTADO_RESULTADOS'

  const ingresos1 = suma('5', 1) - 2 * suma(REBAJAS_DEVOLUCIONES, 1)
  const ingresos2 = suma('5', 2) - 2 * suma(REBAJAS_DEVOLUCIONES, 2)
  const costos1 = suma('4', 1)
  const costos2 = suma('4', 2)

  const totales = [
    total('1', 'Activo total'),
    total('2', 'Pasivo total'),
    total('3', 'Patrimonio'),
    ...(ingresos1 || ingresos2
      ? [
          `Ingresos: ${dinero(ingresos1)} → ${dinero(ingresos2)}`,
          `Costos y gastos: ${dinero(costos1)} → ${dinero(costos2)}`,
          `Utilidad (ingresos − costos): ${dinero(ingresos1 - costos1)} → ${dinero(ingresos2 - costos2)}`,
        ]
      : []),
  ]

  const mensaje = [
    `Análisis comparativo (horizontal y vertical) entre ${anio1} y ${anio2}.`,
    `Estado de los períodos: ${JSON.stringify(periodos)}. Si hay ejercicios provisionales, identifica el análisis como preliminar; no interpretes diferencias de resultados contra años completos como crecimiento anual ni anualices importes.`,
    `Totales:\n${totales.map((t) => `- ${t}`).join('\n')}`,
    `Cuentas de balance con mayor cambio:\n${top(esBalance, 6).join('\n')}`,
    ...(lineas.some(esResultados)
      ? [`Cuentas de resultados con mayor cambio:\n${top(esResultados, 5).join('\n')}`]
      : []),
    `"pesa" = porcentaje vertical (balance sobre activo total; resultados sobre ventas). Explica qué cambió y qué significa para la empresa.`,
  ].join('\n')

  return {
    titulo: `Comparativo ${anio1} vs ${anio2}`,
    clave: `comparativo|${empresaId}|${anio1}|${anio2}`,
    mensaje,
    datosClave: totales.map((t) => {
      const [etiqueta, valor] = t.split(': ')
      return { etiqueta, valor }
    }),
  }
}

const ETIQUETAS_EVOLUCION: Record<string, string> = {
  LIQUIDEZ_CORRIENTE: 'Liquidez corriente (veces)',
  PRUEBA_ACIDA: 'Prueba ácida (veces)',
  ENDEUDAMIENTO: 'Endeudamiento (% del activo)',
  ROE: 'ROE (%)',
  ROA: 'ROA (%)',
}

async function evolucion(d: Datos): Promise<Preparado> {
  const empresaId = numero(d, 'empresaId', { min: 1, entero: true })
  const pedidos = Array.isArray(d.ratios) ? d.ratios.map(String) : Object.keys(ETIQUETAS_EVOLUCION)
  const ratios = pedidos.filter((r) => r in ETIQUETAS_EVOLUCION)
  if (ratios.length === 0) throw new BadRequestException('Seleccione al menos un ratio.')

  const filas = (await calcularEvolucionRatios(empresaId, ratios)).map((m) => Object.fromEntries(m))
  if (filas.length === 0) throw new NotFoundException('No hay estados financieros para graficar.')

  const datosClave = ratios.map((r) => ({
    etiqueta: ETIQUETAS_EVOLUCION[r],
    valor: filas
      .map((f) => {
        const v = f[r]
        return `${f.anio}: ${v == null ? 'no calculable' : num(Number(v))}`
      })
      .join('; '),
  }))

  return {
    titulo: 'Evolución de ratios',
    clave: `evolucion|${empresaId}|${ratios.join(',')}`,
    mensaje: `Evolución de ratios por año:\n${datosClave.map((x) => `- ${x.etiqueta}: ${x.valor}`).join('\n')}\n"no calculable" = patrimonio cero o negativo. Explica la tendencia de cada ratio y si la empresa mejora o empeora.`,
    datosClave,
  }
}

async function ratios(d: Datos): Promise<{ resultado: ResumenIARespuesta }> {
  const empresaId = numero(d, 'empresaId', { min: 1, entero: true })
  const anio = numero(d, 'anio', { min: 1900, entero: true })
  const forzar = d.forzar === true
  // Reutiliza el asistente general: misma caché, mismo gasto de tokens.
  const r = await interpretarRatios(empresaId, anio, forzar)
  return {
    resultado: {
      tipo: 'ratios',
      titulo: `Ratios ${anio}`,
      datosClave: r.ratios.map((x) => ({
        etiqueta: x.nombre,
        valor: `${x.valorTexto}${x.sectorTexto ? ` (sector ${x.sectorTexto})` : ''}`,
      })),
      interpretacion: r.interpretacion,
      modelo: r.modelo,
      generadoEn: r.generadoEn,
      desdeCache: r.desdeCache,
      tokens: r.tokens,
    },
  }
}

function equilibrio(d: Datos): Preparado {
  const costosFijos = numero(d, 'costosFijos', { min: 0 })
  const precio = numero(d, 'precioVenta', { min: 0 })
  const costoVariable = numero(d, 'costoVariable', { min: 0 })
  if (costosFijos < 0) throw new BadRequestException('Los costos fijos no pueden ser negativos.')
  if (precio <= costoVariable) {
    throw new BadRequestException('El precio de venta debe ser mayor que el costo variable unitario.')
  }
  const margen = precio - costoVariable
  const unidades = costosFijos / margen
  const ventas = unidades * precio

  const datosClave = [
    { etiqueta: 'Costos fijos', valor: dinero(costosFijos) },
    { etiqueta: 'Precio de venta unitario', valor: `$${num(precio)}` },
    { etiqueta: 'Costo variable unitario', valor: `$${num(costoVariable)}` },
    { etiqueta: 'Margen de contribución por unidad', valor: `$${num(margen)} (${pct((margen / precio) * 100)} del precio)` },
    { etiqueta: 'Unidades de equilibrio', valor: num(unidades) },
    { etiqueta: 'Ventas de equilibrio', valor: dinero(ventas) },
  ]
  return {
    titulo: 'Punto de equilibrio',
    clave: `equilibrio|${costosFijos}|${precio}|${costoVariable}`,
    mensaje: `Punto de equilibrio (valores escritos por el usuario en una calculadora):\n${datosClave.map((x) => `- ${x.etiqueta}: ${x.valor}`).join('\n')}\nExplica qué significa y qué pasa si vende más o menos de esas unidades.`,
    datosClave,
  }
}

function dupont(d: Datos): Preparado {
  const ventas = numero(d, 'ventas')
  const utilidad = numero(d, 'utilidadNeta')
  const activo = numero(d, 'activoTotal')
  const patrimonio = numero(d, 'patrimonio')
  if (ventas <= 0 || activo <= 0) throw new BadRequestException('Ventas y activo total deben ser mayores que cero.')
  const margen = utilidad / ventas
  const rotacion = ventas / activo
  const multiplicador = patrimonio > 0 ? activo / patrimonio : 0
  const roe = margen * rotacion * multiplicador

  const datosClave = [
    { etiqueta: 'Ventas', valor: dinero(ventas) },
    { etiqueta: 'Utilidad neta', valor: dinero(utilidad) },
    { etiqueta: 'Activo total', valor: dinero(activo) },
    { etiqueta: 'Patrimonio', valor: dinero(patrimonio) },
    { etiqueta: 'Margen neto', valor: pct(margen * 100) },
    { etiqueta: 'Rotación de activos', valor: `${num(rotacion)} veces` },
    {
      etiqueta: 'Multiplicador de capital',
      valor: patrimonio > 0 ? `${num(multiplicador)} veces` : 'no calculable (patrimonio cero o negativo)',
    },
    { etiqueta: 'ROE', valor: pct(roe * 100) },
  ]
  return {
    titulo: 'Sistema DuPont',
    clave: `dupont|${ventas}|${utilidad}|${activo}|${patrimonio}`,
    mensaje: `Análisis DuPont (ROE = margen neto × rotación de activos × multiplicador de capital), valores de una calculadora:\n${datosClave.map((x) => `- ${x.etiqueta}: ${x.valor}`).join('\n')}\nExplica de dónde viene la rentabilidad y cuál de los tres factores pesa más.`,
    datosClave,
  }
}

const METODOS: Record<MetodoProyeccion, string> = {
  MINIMOS_CUADRADOS: 'mínimos cuadrados (tendencia lineal)',
  INCREMENTO_PORCENTUAL: 'incremento porcentual promedio',
  INCREMENTO_ABSOLUTO: 'incremento absoluto promedio',
}

async function proyeccion(d: Datos): Promise<Preparado> {
  const empresaId = numero(d, 'empresaId', { min: 1, entero: true })
  const metodo = String(d.metodo ?? '') as MetodoProyeccion
  if (!(metodo in METODOS)) throw new BadRequestException(`Método de proyección inválido: ${metodo}`)

  const { data, error } = await supabaseAdmin
    .from('venta')
    .select('id_venta, fecha_venta, monto_venta, observacion, empresa_id')
    .eq('empresa_id', empresaId)
    .order('fecha_venta', { ascending: true })
  if (error) throw error
  const ventas = (data ?? []) as VentaRow[]
  const proy = calcularProyeccion(empresaId, ventas, 12, metodo)
  if (proy.length === 0) throw new NotFoundException('No se pudo generar la proyección.')

  const historico = ventas.slice(-12).map((v) => `${v.fecha_venta}: ${dinero(Number(v.monto_venta))}`)
  const primero = proy[0]
  const ultimo = proy.at(-1)!
  const cambioMensual = proy.length > 1 ? (ultimo.montoProyectado - primero.montoProyectado) / (proy.length - 1) : 0

  const datosClave = [
    { etiqueta: 'Método', valor: METODOS[metodo] },
    { etiqueta: 'Registros históricos', valor: String(ventas.length) },
    { etiqueta: `Proyección ${primero.fechaProyectada}`, valor: dinero(primero.montoProyectado) },
    { etiqueta: `Proyección ${ultimo.fechaProyectada}`, valor: dinero(ultimo.montoProyectado) },
    { etiqueta: 'Cambio promedio por mes proyectado', valor: dinero(cambioMensual) },
  ]
  return {
    titulo: 'Proyección de ventas',
    clave: `proyeccion|${empresaId}|${metodo}`,
    mensaje: `Proyección de ventas a 12 meses por ${METODOS[metodo]}.\nVentas históricas usadas (fecha: monto):\n${historico.map((h) => `- ${h}`).join('\n')}\nResultado:\n${datosClave.slice(2).map((x) => `- ${x.etiqueta}: ${x.valor}`).join('\n')}\nExplica la tendencia. Si los registros históricos son pocos o no son mensuales, advierte que la proyección es poco confiable.`,
    datosClave,
  }
}

async function pronostico(d: Datos): Promise<Preparado> {
  if (d.empresaId !== undefined) {
    const empresa = await getEmpresaPrincipal()
    if (numero(d, 'empresaId', { min: 1, entero: true }) !== empresa.empresaId) throw new BadRequestException('Empresa inválida.')
    const periodicidad = d.periodicidad === 'anual' ? 'anual' : d.periodicidad === 'mensual' ? 'mensual' : null
    if (!periodicidad) throw new BadRequestException('Periodicidad inválida.')
    const periodos = numero(d, 'periodos', { min: 1, entero: true })
    const {ventas} = await obtenerVentasProyeccion(empresa.empresaId,periodicidad)
    const p = pronosticarVentas(ventas, periodicidad, periodos)
    const datosClave = p.proyecciones.map(f => ({ etiqueta: f.periodo, valor: `Promedio móvil ${dinero(f.movil)}; logarítmica ${dinero(f.logaritmica)}; cuadrática ${dinero(f.cuadratica)}` }))
    return { titulo: 'Pronóstico de ventas', clave: `pronostico|${empresa.empresaId}|${periodicidad}|${periodos}`, datosClave, mensaje: `Pronóstico ${periodicidad}. Histórico real: ${p.historico.map(f => `${f.periodo}: ${dinero(f.monto)}`).join('; ')}. Resultados: ${datosClave.map(f => `${f.etiqueta}: ${f.valor}`).join('; ')}. Compara los tres métodos y advierte sobre extrapolación con pocos datos. No confundir años con meses.` }
  }
  const ventas = listaNumeros(d, 'ventas', 3, 36)
  const periodos = Math.min(numero(d, 'periodos', { min: 1, entero: true }), 12)
  const movil = proyeccionPromedioMovil(ventas, 3, periodos)
  const logaritmica = proyeccionLogaritmica(ventas, periodos)

  const datosClave = [
    { etiqueta: 'Ventas históricas', valor: ventas.map(num).join(', ') },
    { etiqueta: 'Promedio móvil (n=3)', valor: movil.map(num).join(', ') },
    { etiqueta: 'Regresión logarítmica', valor: logaritmica.map(num).join(', ') },
  ]
  return {
    titulo: 'Pronóstico de ventas',
    clave: `pronostico|${periodos}|${ventas.join(',')}`,
    mensaje: `Pronóstico de ventas de ${periodos} periodos con dos métodos:\n${datosClave.map((x) => `- ${x.etiqueta}: ${x.valor}`).join('\n')}\nCompara los dos métodos en palabras sencillas y explica cuál parece más prudente para planificar.`,
    datosClave,
  }
}

async function proforma(d: Datos): Promise<Preparado> {
  if (d.anioBase !== undefined) {
    const empresa = await getEmpresaPrincipal()
    const base = await obtenerBaseFinanciera(empresa.empresaId, numero(d, 'anioBase', { min: 1900, entero: true }))
    let p
    try { p = generarProforma(base, { ventasProyectadas: base.ventas * (1 + numero(d, 'crecimiento') / 100), retencion: numero(d, 'retencion'), porcentajeVariableGastos: numero(d, 'porcentajeVariableGastos') }) }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : 'Supuestos inválidos.') }
    const datosClave = [{ etiqueta: 'Ingresos proyectados', valor: dinero(p.ingresos) }, { etiqueta: 'Costos y gastos', valor: dinero(p.gastos) }, { etiqueta: 'Utilidad neta', valor: dinero(p.utilidad) }, { etiqueta: 'Utilidad retenida', valor: dinero(p.retenida) }, { etiqueta: 'Financiamiento externo requerido (FER)', valor: dinero(p.fer) }, { etiqueta: 'Total activos', valor: dinero(p.activos) }, { etiqueta: 'Total pasivos', valor: dinero(p.pasivos) }, { etiqueta: 'Patrimonio', valor: dinero(p.patrimonio) }]
    return { titulo: `Estados Proforma ${p.anio}`, clave: `proforma|${empresa.empresaId}|${base.anio}|${JSON.stringify(d)}`, datosClave, mensaje: `Proforma a partir de estados reales de ${base.anio}. Ingresos y costo de ventas proporcionales, gastos operativos variables ${d.porcentajeVariableGastos}%, demás gastos fijos; activos corrientes sin caja y proveedores proporcionales. Retención ${d.retencion}%. ${datosClave.map(f => `${f.etiqueta}: ${f.valor}`).join('; ')}. Explica las hipótesis, FER positivo requiere financiamiento y negativo se conserva como efectivo. No presentes la proyección como certeza.` }
  }
  const ventasActuales = numero(d, 'ventasActuales', { min: 0 })
  const ventasProyectadas = numero(d, 'ventasProyectadas', { min: 0 })
  const activos = numero(d, 'activosEspontaneos', { min: 0 })
  const pasivos = numero(d, 'pasivosEspontaneos', { min: 0 })
  const margenPct = numero(d, 'margenNetoPorcentaje')
  const retencionPct = numero(d, 'retencionPorcentaje', { min: 0 })
  if (ventasActuales <= 0) throw new BadRequestException('Las ventas actuales deben ser mayores que cero.')

  // Mismas fórmulas que la pantalla de Estados Proforma
  const variacion = ventasProyectadas - ventasActuales
  const incActivos = (activos / ventasActuales) * variacion
  const incPasivos = (pasivos / ventasActuales) * variacion
  const utilidad = ventasProyectadas * (margenPct / 100)
  const retenida = utilidad * (retencionPct / 100)
  const fer = incActivos - incPasivos - retenida

  const datosClave = [
    { etiqueta: 'Ventas actuales → proyectadas', valor: `${dinero(ventasActuales)} → ${dinero(ventasProyectadas)}` },
    { etiqueta: 'Nuevos activos requeridos', valor: dinero(incActivos) },
    { etiqueta: 'Financiamiento espontáneo (pasivos)', valor: dinero(incPasivos) },
    { etiqueta: `Utilidad retenida (margen ${pct(margenPct)}, retención ${pct(retencionPct)})`, valor: dinero(retenida) },
    { etiqueta: 'Financiamiento externo requerido (FER)', valor: dinero(fer) },
  ]
  return {
    titulo: 'Estados proforma y FER',
    clave: `proforma|${[ventasActuales, ventasProyectadas, activos, pasivos, margenPct, retencionPct].join('|')}`,
    mensaje: `Método del porcentaje de ventas, valores de una calculadora:\n${datosClave.map((x) => `- ${x.etiqueta}: ${x.valor}`).join('\n')}\nFER positivo = necesita pedir financiamiento; negativo = le sobran fondos. Explica el resultado y qué opciones tiene la empresa.`,
    datosClave,
  }
}

function presupuesto(d: Datos): Preparado {
  // Los supuestos llegan del navegador: se validan y se recalcula todo aquí.
  const s = d as unknown as SupuestosPresupuesto
  let p
  try {
    const errores = validarSupuestos(s)
    if (errores.length > 0) throw new BadRequestException(errores.join(' '))
    p = calcularPresupuesto(s)
  } catch (err) {
    if (err instanceof BadRequestException) throw err
    throw new BadRequestException('Los supuestos del presupuesto no tienen el formato esperado.')
  }

  const r = p.resumen
  const c = p.caja
  const meses = MESES.map((mes, i) => {
    const fin = c.financiamientoRequerido.at(i) ?? 0
    return `${mes}: entradas ${dinero(c.totalEntradas.at(i) ?? 0)}, desembolsos ${dinero(c.totalDesembolsos.at(i) ?? 0)}, flujo ${dinero(c.flujoNeto.at(i) ?? 0)}, efectivo final ${dinero(c.efectivoFinal.at(i) ?? 0)}${fin > 0 ? `, FINANCIAMIENTO ${dinero(fin)}` : ''}`
  })
  const anual = (lista: number[]) => dinero(lista.reduce((a, b) => a + b, 0))

  const datosClave = [
    { etiqueta: 'Ventas del año', valor: dinero(r.ventasAnuales) },
    { etiqueta: 'Compras de materia prima', valor: anual(p.materiaPrima.compras) },
    { etiqueta: 'Mano de obra directa', valor: anual(p.manoObra.costo) },
    { etiqueta: 'CIF en efectivo', valor: anual(p.cif.efectivo) },
    { etiqueta: 'Gastos de operación', valor: anual(p.gastosOperacion.total) },
    { etiqueta: 'Otros desembolsos', valor: anual(c.otros.flatMap((o) => o.montos)) },
    { etiqueta: 'Entradas de efectivo', valor: dinero(r.entradasAnuales) },
    { etiqueta: 'Desembolsos de efectivo', valor: dinero(r.desembolsosAnuales) },
    { etiqueta: 'Flujo neto del año', valor: dinero(r.flujoNetoAnual) },
    { etiqueta: 'Efectivo inicial / saldo mínimo', valor: `${dinero(s.caja.efectivoInicial)} / ${dinero(s.caja.saldoMinimo)}` },
    { etiqueta: 'Financiamiento máximo requerido', valor: dinero(r.financiamientoMaximo) },
    {
      etiqueta: 'Meses bajo el saldo mínimo',
      valor: r.mesesConFinanciamiento.length ? r.mesesConFinanciamiento.map((m) => MESES.at(m)).join(', ') : 'ninguno',
    },
  ]

  return {
    titulo: `Presupuesto maestro ${s.anio}`,
    clave: `presupuesto|${s.anio}`,
    mensaje: `Presupuesto maestro de ${p.anio} de una empresa manufacturera (cobros: ${s.cobros.contado}% contado, ${s.cobros.a30}% a 30 días, ${s.cobros.a60}% a 60 días, ${s.cobros.incobrable}% incobrable).\nTotales del año:\n${datosClave.map((x) => `- ${x.etiqueta}: ${x.valor}`).join('\n')}\nCaja por mes:\n${meses.join('\n')}\nExplica los meses críticos de efectivo, por qué ocurren y cuánto financiamiento necesitaría.`,
    datosClave,
  }
}

function capital(d: Datos): Preparado {
  // Los proyectos llegan del navegador: se validan y se recalcula todo aquí.
  const s = d as unknown as SupuestosCapital
  let c
  try {
    const errores = validarCapital(s)
    if (errores.length > 0) throw new BadRequestException(errores.join(' '))
    c = compararProyectos(s)
  } catch (err) {
    if (err instanceof BadRequestException) throw err
    throw new BadRequestException('Los datos de los proyectos no tienen el formato esperado.')
  }

  const anios = (v: number | null) => (v == null ? 'no se recupera' : `${num(v)} años`)
  const datosClave = c.evaluaciones.flatMap((e) => [
    {
      etiqueta: `${e.nombre}`,
      valor: `desembolso ${dinero(e.desembolsoInicial)}; flujos netos ${e.flujos.flujoNeto.map((f) => dinero(f)).join(', ')}`,
    },
    {
      etiqueta: `${e.nombre} · indicadores`,
      valor: `VAN ${dinero(e.van)}; TIR ${e.tir.valor == null ? 'no existe' : pct(e.tir.valor)}; B/C ${e.bc == null ? 'no aplica' : num(e.bc)}; payback ${anios(e.paybackSimple)} (descontado ${anios(e.paybackDescontado)})`,
    },
  ])
  const mejor = c.mejorPorVAN != null ? c.evaluaciones.at(c.mejorPorVAN)?.nombre : null
  const mejorTir = c.mejorPorTIR != null ? c.evaluaciones.at(c.mejorPorTIR)?.nombre : null
  const avisos = c.evaluaciones.filter((e) => e.tir.aviso).map((e) => `${e.nombre}: ${e.tir.aviso}`)

  return {
    titulo: 'Presupuesto de capital',
    clave: `capital|${s.tmar}|${s.impuesto}`,
    mensaje: [
      `Evaluación de ${c.evaluaciones.length} proyecto(s) de inversión con TMAR ${pct(s.tmar)} e ISR ${pct(s.impuesto)}. Flujo neto = utilidad después de impuestos + depreciación (año 0 = inversión + capital de trabajo).`,
      ...datosClave.map((x) => `- ${x.etiqueta}: ${x.valor}`),
      `Mayor VAN: ${mejor ?? 'ninguno positivo'}. Mayor TIR: ${mejorTir ?? 'ninguna'}.${c.conflicto ? ' VAN y TIR recomiendan proyectos distintos.' : ''}`,
      ...avisos,
      'Explica cuál conviene y por qué (VAN > 0, TIR > TMAR, B/C > 1, tiempo de recuperación) en palabras sencillas.',
    ].join('\n'),
    datosClave,
  }
}

// ---------------------------------------------------------------
// Punto de entrada
// ---------------------------------------------------------------

export async function resumirAnalisis(tipo: TipoResumen, datos: Datos, forzar = false): Promise<ResumenIARespuesta> {
  if (tipo === 'ratios') {
    return (await ratios({ ...datos, forzar })).resultado
  }

  const preparadores: Record<Exclude<TipoResumen, 'ratios'>, (d: Datos) => Preparado | Promise<Preparado>> = {
    comparativo,
    evolucion,
    equilibrio,
    dupont,
    proyeccion,
    pronostico,
    proforma,
    presupuesto,
    capital,
  }
  const p = await preparadores[tipo](datos)
  const { interpretacion, meta } = await interpretarConCache(p.clave, p.mensaje, forzar)
  return { tipo, titulo: p.titulo, datosClave: p.datosClave, interpretacion, ...meta }
}
