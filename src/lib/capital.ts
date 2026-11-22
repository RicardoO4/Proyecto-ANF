// ================================================================
// Presupuesto de capital — Módulo E (E3).
//
// Fórmulas PURAS (sin Supabase ni I/O), como lib/presupuesto.ts: las usan
// la pantalla, el Excel, el resumen con IA y scripts/verify-capital.mts.
//
// Flujo neto de cada año (modo detallado):
//   UAI          = ingresos − costos − depreciación
//   impuesto     = UAI × %ISR (0 si hay pérdida)
//   flujo neto   = (UAI − impuesto) + depreciación
//   año 0        = −(inversión inicial + capital de trabajo)
//   último año   + valor de rescate + recuperación del capital de trabajo
//
// Indicadores: VAN, TIR, relación beneficio/costo, payback simple y
// descontado (con fracción de año).
// ================================================================

export const MAX_PROYECTOS = 3
export const MAX_ANIOS = 15

export interface ProyectoInversion {
  nombre: string
  inversionInicial: number
  capitalTrabajo: number
  vidaUtil: number
  valorRescate: number
  /** Un valor por año (1..vidaUtil). */
  ingresos: number[]
  costos: number[]
  depreciacion: number[]
}

export interface SupuestosCapital {
  /** Tasa mínima atractiva de rendimiento, en %. */
  tmar: number
  /** Impuesto sobre la renta, en %. */
  impuesto: number
  proyectos: ProyectoInversion[]
}

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------

export function redondear(valor: number, decimales = 2): number {
  const f = Math.pow(10, decimales)
  return Math.round((valor + Number.EPSILON) * f) / f
}

const r2 = (v: number) => redondear(v, 2)
const en = (lista: number[], i: number) => (i >= 0 && i < lista.length ? lista.at(i) ?? 0 : 0)

/** Ajusta una lista a `n` años: recorta o completa con el último valor (o 0). */
export function ajustarAnios(lista: number[], n: number): number[] {
  const relleno = lista.length > 0 ? lista.at(-1) ?? 0 : 0
  return Array.from({ length: n }, (_, i) => (i < lista.length ? en(lista, i) : relleno))
}

/** Depreciación en línea recta: (inversión − rescate) ÷ vida útil. */
export function depreciacionLineal(inversion: number, rescate: number, vidaUtil: number): number[] {
  const n = Math.max(1, Math.round(vidaUtil))
  const anual = r2(Math.max(0, inversion - rescate) / n)
  return Array.from({ length: n }, () => anual)
}

// ---------------------------------------------------------------
// Validación
// ---------------------------------------------------------------

export function validarCapital(s: SupuestosCapital): string[] {
  const errores: string[] = []
  if (!Number.isFinite(s.tmar) || s.tmar <= -100 || s.tmar > 1000) errores.push('La TMAR debe ser un porcentaje válido (por ejemplo 12).')
  if (!Number.isFinite(s.impuesto) || s.impuesto < 0 || s.impuesto >= 100) errores.push('El impuesto debe estar entre 0 y 99%.')
  if (s.proyectos.length === 0) errores.push('Agregue al menos un proyecto.')
  if (s.proyectos.length > MAX_PROYECTOS) errores.push(`Se comparan como máximo ${MAX_PROYECTOS} proyectos.`)

  s.proyectos.forEach((p, i) => {
    const nombre = p.nombre?.trim() || `Proyecto ${i + 1}`
    if (!Number.isInteger(p.vidaUtil) || p.vidaUtil < 1 || p.vidaUtil > MAX_ANIOS) {
      errores.push(`${nombre}: la vida útil debe ser de 1 a ${MAX_ANIOS} años.`)
      return
    }
    if (!(p.inversionInicial > 0)) errores.push(`${nombre}: la inversión inicial debe ser mayor que cero.`)
    if ([p.capitalTrabajo, p.valorRescate].some((v) => !Number.isFinite(v) || v < 0)) {
      errores.push(`${nombre}: capital de trabajo y valor de rescate no pueden ser negativos.`)
    }
    for (const [campo, lista] of [
      ['ingresos', p.ingresos],
      ['costos', p.costos],
      ['depreciación', p.depreciacion],
    ] as const) {
      if (lista.length !== p.vidaUtil) errores.push(`${nombre}: ${campo} debe tener ${p.vidaUtil} años.`)
      else if (lista.some((v) => !Number.isFinite(v) || v < 0)) errores.push(`${nombre}: ${campo} no puede tener valores negativos.`)
    }
  })
  return errores
}

// ---------------------------------------------------------------
// Flujos de efectivo
// ---------------------------------------------------------------

export interface FlujosProyecto {
  /** Años 1..n */
  ingresos: number[]
  costos: number[]
  depreciacion: number[]
  utilidadAntesImpuestos: number[]
  impuesto: number[]
  utilidadNeta: number[]
  flujoOperativo: number[]
  /** Años 0..n */
  inversion: number[]
  capitalTrabajo: number[]
  valorRescate: number[]
  /** Entradas y salidas separadas, positivas, para B/C (incluyen año 0). */
  entradasEfectivo: number[]
  salidasEfectivo: number[]
  flujoNeto: number[]
}

export function flujosProyecto(p: ProyectoInversion, impuestoPct: number): FlujosProyecto {
  const n = p.vidaUtil
  const anios = Array.from({ length: n }, (_, i) => i)
  const ingresos = anios.map((i) => r2(en(p.ingresos, i)))
  const costos = anios.map((i) => r2(en(p.costos, i)))
  const depreciacion = anios.map((i) => r2(en(p.depreciacion, i)))
  const utilidadAntesImpuestos = anios.map((i) => r2(en(ingresos, i) - en(costos, i) - en(depreciacion, i)))
  const impuesto = utilidadAntesImpuestos.map((u) => r2(Math.max(0, u) * (impuestoPct / 100)))
  const utilidadNeta = anios.map((i) => r2(en(utilidadAntesImpuestos, i) - en(impuesto, i)))
  const flujoOperativo = anios.map((i) => r2(en(utilidadNeta, i) + en(depreciacion, i)))

  const ceros = Array.from({ length: n + 1 }, () => 0)
  const inversion = ceros.map((_, t) => (t === 0 ? -r2(p.inversionInicial) : 0))
  const capitalTrabajo = ceros.map((_, t) => (t === 0 ? -r2(p.capitalTrabajo) : t === n ? r2(p.capitalTrabajo) : 0))
  const valorRescate = ceros.map((_, t) => (t === n ? r2(p.valorRescate) : 0))
  const entradasEfectivo = ceros.map((_, t) => r2(
    (t > 0 ? en(ingresos, t - 1) : 0) + en(valorRescate, t) + Math.max(0, en(capitalTrabajo, t)),
  ))
  const salidasEfectivo = ceros.map((_, t) => r2(
    -en(inversion, t) + Math.max(0, -en(capitalTrabajo, t)) + (t > 0 ? en(costos, t - 1) + en(impuesto, t - 1) : 0),
  ))
  const flujoNeto = ceros.map((_, t) =>
    r2(en(inversion, t) + en(capitalTrabajo, t) + en(valorRescate, t) + (t > 0 ? en(flujoOperativo, t - 1) : 0)),
  )

  return {
    ingresos,
    costos,
    depreciacion,
    utilidadAntesImpuestos,
    impuesto,
    utilidadNeta,
    flujoOperativo,
    inversion,
    capitalTrabajo,
    valorRescate,
    entradasEfectivo,
    salidasEfectivo,
    flujoNeto,
  }
}

// ---------------------------------------------------------------
// Indicadores (flujos[0] = año 0)
// ---------------------------------------------------------------

/** Valor actual neto a la tasa dada (en %). */
export function van(flujos: number[], tasaPct: number): number {
  const k = tasaPct / 100
  return flujos.reduce((suma, f, t) => suma + f / Math.pow(1 + k, t), 0)
}

export interface ResultadoTIR {
  /** TIR en %, o null si no existe. */
  valor: number | null
  /** Aviso en lenguaje sencillo cuando la TIR no existe o hay más de una. */
  aviso: string | null
}

/** Aísla raíces reales por intervalos monótonos, incluyendo raíces tangentes. */
function raicesPolinomio(coeficientes: number[], minimo: number, maximo: number): number[] {
  const c = [...coeficientes]
  while (c.length > 1 && c.at(-1) === 0) c.pop()
  if (c.length < 2) return []
  const escala = Math.max(...c.map(Math.abs))
  const normalizados = c.map(v => v / escala)
  const evaluar = (x: number) => normalizados.reduceRight((s, v) => s * x + v, 0)
  const esRaiz = (x: number) => {
    const magnitud = normalizados.reduceRight((s, v) => s * Math.abs(x) + Math.abs(v), 0)
    return Math.abs(evaluar(x)) <= 1e-12 * magnitud
  }
  if (c.length === 2) {
    const raiz = -c[0] / c[1]
    return raiz >= minimo && raiz <= maximo ? [raiz] : []
  }
  const derivada = normalizados.slice(1).map((v, i) => v * (i + 1))
  const puntos = [minimo, ...raicesPolinomio(derivada, minimo, maximo), maximo]
  const raices = puntos.filter(esRaiz)
  for (let i = 1; i < puntos.length; i++) {
    let lo = puntos[i - 1], hi = puntos[i]
    if (esRaiz(lo) || esRaiz(hi)) continue
    let vlo = evaluar(lo)
    if ((vlo < 0) === (evaluar(hi) < 0)) continue
    for (let j = 0; j < 100; j++) {
      const mid = (lo + hi) / 2, vm = evaluar(mid)
      if (vm === 0) { lo = mid; hi = mid; break }
      if ((vlo < 0) !== (vm < 0)) hi = mid
      else { lo = mid; vlo = vm }
    }
    raices.push((lo + hi) / 2)
  }
  return raices.sort((a, b) => a - b).filter((v, i, lista) => i === 0 || Math.abs(v - lista[i - 1]) > 1e-9 * Math.max(1, Math.abs(v)))
}

/** Tasas entre −99% y 1000%. VAN = Σ flujo[t] × x^t, x = 1/(1+tasa). */
export function tir(flujos: number[]): ResultadoTIR {
  const positivos = flujos.some((f) => f > 0)
  const negativos = flujos.some((f) => f < 0)
  if (!positivos || !negativos) {
    return { valor: null, aviso: 'No existe TIR: los flujos no cambian de signo.' }
  }

  const raices = raicesPolinomio(flujos, 1 / 11, 100).map(x => (1 / x - 1) * 100).sort((a, b) => a - b)

  if (raices.length === 0) {
    return { valor: null, aviso: 'No se encontró TIR en el rango de −99% a 1000%.' }
  }
  return {
    valor: redondear(raices[0], 4),
    aviso:
      raices.length > 1
        ? `Hay ${raices.length} TIR porque los flujos cambian de signo varias veces; use el VAN para decidir.`
        : null,
  }
}

/** Entradas/salidas brutas separadas. Sin salidas explícitas admite una serie de cobros y pagos con signo. */
export function relacionBC(flujos: number[], tasaPct: number, salidasEfectivo?: number[]): number | null {
  const k = tasaPct / 100
  let entradas = 0
  let salidas = 0
  flujos.forEach((f, t) => {
    const vp = f / Math.pow(1 + k, t)
    if (salidasEfectivo) {
      entradas += vp
      salidas += en(salidasEfectivo, t) / Math.pow(1 + k, t)
    } else if (vp >= 0) entradas += vp
    else salidas += -vp
  })
  return salidas === 0 ? null : redondear(entradas / salidas, 4)
}

/** Años (con fracción) hasta que el acumulado deja de ser negativo; null si nunca. */
function recuperacion(flujos: number[]): number | null {
  let acumulado = 0
  for (let t = 0; t < flujos.length; t++) {
    const f = en(flujos, t)
    const anterior = acumulado
    acumulado += f
    if (t > 0 && anterior < 0 && acumulado >= 0) {
      return redondear(t - 1 + -anterior / f, 2)
    }
  }
  return null
}

export function paybackSimple(flujos: number[]): number | null {
  return recuperacion(flujos)
}

export function paybackDescontado(flujos: number[], tasaPct: number): number | null {
  const k = tasaPct / 100
  return recuperacion(flujos.map((f, t) => f / Math.pow(1 + k, t)))
}

// ---------------------------------------------------------------
// Evaluación y comparación
// ---------------------------------------------------------------

export interface EvaluacionProyecto {
  nombre: string
  flujos: FlujosProyecto
  van: number
  tir: ResultadoTIR
  bc: number | null
  paybackSimple: number | null
  paybackDescontado: number | null
  /** Desembolso del año 0 (inversión + capital de trabajo). */
  desembolsoInicial: number
  criterios: { van: boolean; tir: boolean; bc: boolean }
}

export function evaluarProyecto(p: ProyectoInversion, s: SupuestosCapital): EvaluacionProyecto {
  const flujos = flujosProyecto(p, s.impuesto)
  const fn = flujos.flujoNeto
  const vanValor = redondear(van(fn, s.tmar), 2)
  const tirValor = tir(fn)
  const bc = relacionBC(flujos.entradasEfectivo, s.tmar, flujos.salidasEfectivo)
  return {
    nombre: p.nombre?.trim() || 'Proyecto',
    flujos,
    van: vanValor,
    tir: tirValor,
    bc,
    paybackSimple: paybackSimple(fn),
    paybackDescontado: paybackDescontado(fn, s.tmar),
    desembolsoInicial: r2(p.inversionInicial + p.capitalTrabajo),
    criterios: {
      van: vanValor > 0,
      tir: tirValor.valor != null && tirValor.valor > s.tmar,
      bc: bc != null && bc > 1,
    },
  }
}

export interface ComparacionCapital {
  evaluaciones: EvaluacionProyecto[]
  /** Índice del proyecto de mayor VAN (null si ninguno tiene VAN positivo). */
  mejorPorVAN: number | null
  /** Índice del proyecto de mayor TIR (entre los que tienen TIR). */
  mejorPorTIR: number | null
  /** VAN y TIR recomiendan proyectos distintos. */
  conflicto: boolean
}

export function compararProyectos(s: SupuestosCapital): ComparacionCapital {
  const evaluaciones = s.proyectos.map((p) => evaluarProyecto(p, s))

  let mejorPorVAN: number | null = null
  evaluaciones.forEach((e, i) => {
    if (e.van > 0 && (mejorPorVAN === null || e.van > (evaluaciones.at(mejorPorVAN)?.van ?? -Infinity))) mejorPorVAN = i
  })
  let mejorPorTIR: number | null = null
  evaluaciones.forEach((e, i) => {
    const t = e.tir.valor
    if (t != null && (mejorPorTIR === null || t > (evaluaciones.at(mejorPorTIR)?.tir.valor ?? -Infinity))) mejorPorTIR = i
  })

  return {
    evaluaciones,
    mejorPorVAN,
    mejorPorTIR,
    conflicto: evaluaciones.length > 1 && mejorPorVAN !== null && mejorPorTIR !== null && mejorPorVAN !== mejorPorTIR,
  }
}

/** VAN de cada flujo a varias tasas (para el gráfico del perfil del VAN). */
export function perfilVAN(flujosPorProyecto: number[][], tasas: number[]): { tasa: number; vans: number[] }[] {
  return tasas.map((tasa) => ({ tasa, vans: flujosPorProyecto.map((f) => redondear(van(f, tasa), 2)) }))
}

// ---------------------------------------------------------------
// Proyectos de ejemplo
// ---------------------------------------------------------------

export function proyectoNuevo(nombre: string, vidaUtil = 5): ProyectoInversion {
  const inversion = 50_000
  const rescate = 5_000
  return {
    nombre,
    inversionInicial: inversion,
    capitalTrabajo: 5_000,
    vidaUtil,
    valorRescate: rescate,
    ingresos: Array.from({ length: vidaUtil }, () => 30_000),
    costos: Array.from({ length: vidaUtil }, () => 12_000),
    depreciacion: depreciacionLineal(inversion, rescate, vidaUtil),
  }
}

export function capitalEjemplo(): SupuestosCapital {
  return {
    tmar: 12,
    impuesto: 30,
    proyectos: [
      {
        nombre: 'Máquina automática',
        inversionInicial: 50_000,
        capitalTrabajo: 5_000,
        vidaUtil: 5,
        valorRescate: 5_000,
        ingresos: [28_000, 30_000, 32_000, 32_000, 30_000],
        costos: [10_000, 11_000, 12_000, 12_000, 12_000],
        depreciacion: depreciacionLineal(50_000, 5_000, 5),
      },
      {
        nombre: 'Ampliar línea actual',
        inversionInicial: 30_000,
        capitalTrabajo: 3_000,
        vidaUtil: 4,
        valorRescate: 2_000,
        ingresos: [18_000, 20_000, 20_000, 18_000],
        costos: [7_000, 8_000, 8_000, 8_000],
        depreciacion: depreciacionLineal(30_000, 2_000, 4),
      },
    ],
  }
}
