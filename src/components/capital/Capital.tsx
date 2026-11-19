'use client'

// Presupuesto de capital (Módulo E, E3): compara hasta 3 proyectos con VAN,
// TIR, relación B/C y payback. Los datos se guardan como borrador en este
// navegador y se descargan en Excel; no se escribe en la base de datos.
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import SubMenu from '@/components/shared/SubMenu'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import DocumentosGuardados, { type DocumentoResumen } from '@/components/shared/DocumentosGuardados'
import { proyeccionesSubMenuLinks } from '@/config/menuConfig'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import { apiClient, getErrorMessage } from '@/services/api'
import { Notifier } from '@/utils/Notifier'
import {
  MAX_PROYECTOS,
  capitalEjemplo,
  compararProyectos,
  perfilVAN,
  proyectoNuevo,
  validarCapital,
  van,
  type SupuestosCapital,
} from '@/lib/capital'
import {
  CLAVE_BORRADOR_PRESUPUESTO,
  MESES,
  calcularPresupuesto,
  validarSupuestos,
  type SupuestosPresupuesto,
} from '@/lib/presupuesto'
import { formatear } from '@/components/presupuesto/TablaMensual'
import ProyectoForm from './ProyectoForm'
import { exportarCapitalExcel } from './exportarExcel'

import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import tabStyles from '@/styles/proyeccion/Proyecciones.module.css'
import styles from '@/styles/presupuesto/Presupuestos.module.css'

const CLAVE_BORRADOR = 'anf_capital_borrador_v1'
const COLORES = ['var(--fey-signal)', 'var(--accent-positive)', 'var(--fey-ember)']

const dinero = (v: number) => `$${formatear(v)}`
const anios = (v: number | null) => (v == null ? 'No se recupera' : `${v.toFixed(2)} años`)

function leerBorrador(): SupuestosCapital {
  try {
    const texto = typeof window !== 'undefined' ? window.localStorage.getItem(CLAVE_BORRADOR) : null
    if (!texto) return capitalEjemplo()
    const guardado = JSON.parse(texto) as SupuestosCapital
    return Array.isArray(guardado?.proyectos) && guardado.proyectos.length > 0 ? guardado : capitalEjemplo()
  } catch {
    return capitalEjemplo()
  }
}

function guardarBorrador(s: SupuestosCapital) {
  try {
    window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(s))
  } catch {
    // Sin almacenamiento disponible: la pantalla sigue funcionando.
  }
}

/** Excedente de efectivo a diciembre según el borrador del presupuesto de caja (E2). */
interface ResumenCaja {
  anio: number
  /** "borrador del navegador" o el nombre del presupuesto guardado. */
  origen: string
  excedenteDiciembre: number
  financiamientoMaximo: number
  mesesConFinanciamiento: string[]
}

/** Resume un presupuesto de caja (E2) para el chequeo de financiamiento. */
function resumirCaja(s: SupuestosPresupuesto, origen: string): ResumenCaja | null {
  try {
    if (validarSupuestos(s).length > 0) return null
    const p = calcularPresupuesto(s)
    return {
      anio: p.anio,
      origen,
      excedenteDiciembre: Math.round((p.resumen.efectivoFinalAnual - s.caja.saldoMinimo) * 100) / 100,
      financiamientoMaximo: p.resumen.financiamientoMaximo,
      mesesConFinanciamiento: p.resumen.mesesConFinanciamiento.map((m) => MESES.at(m) ?? ''),
    }
  } catch {
    return null
  }
}

/** Borrador del presupuesto de caja guardado en este navegador. */
function leerPresupuestoCaja(): ResumenCaja | null {
  try {
    const texto = window.localStorage.getItem(CLAVE_BORRADOR_PRESUPUESTO)
    return texto ? resumirCaja(JSON.parse(texto) as SupuestosPresupuesto, 'borrador del navegador') : null
  } catch {
    return null
  }
}

const Capital = () => {
  const [supuestos, setSupuestos] = useState<SupuestosCapital>(leerBorrador)
  const [activo, setActivo] = useState(0)
  const [caja, setCaja] = useState<ResumenCaja | null>(() => (typeof window !== 'undefined' ? leerPresupuestoCaja() : null))
  // Fuente del chequeo: '' = borrador del navegador; si no, id de un presupuesto guardado.
  const [fuenteCaja, setFuenteCaja] = useState('')
  const [presupuestosGuardados, setPresupuestosGuardados] = useState<DocumentoResumen[]>([])
  const { empresa } = useEmpresaPrincipal(async (e) => {
    try {
      const resp = await apiClient.get<DocumentoResumen[]>('/presupuestos', { params: { empresaId: e.empresaId } })
      setPresupuestosGuardados(resp.data)
    } catch {
      // Sin tablas (migración 007) o sin conexión: queda solo el borrador del navegador.
    }
  })

  const cambiarFuenteCaja = async (valor: string) => {
    setFuenteCaja(valor)
    if (!valor) {
      setCaja(leerPresupuestoCaja())
      return
    }
    try {
      const resp = await apiClient.get<DocumentoResumen & { datos: SupuestosPresupuesto }>(`/presupuestos/${valor}`)
      setCaja(resumirCaja(resp.data.datos, `"${resp.data.nombre}"`))
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudo abrir el presupuesto guardado.'))
    }
  }

  const cambiar = (s: SupuestosCapital) => {
    setSupuestos(s)
    guardarBorrador(s)
  }

  const errores = useMemo(() => validarCapital(supuestos), [supuestos])
  const comparacion = useMemo(() => (errores.length === 0 ? compararProyectos(supuestos) : null), [supuestos, errores])

  // Perfil del VAN: de 0% hasta 10 puntos por encima de la mayor TIR (mín. 40%).
  const datosPerfil = useMemo(() => {
    if (!comparacion) return []
    const maxTir = Math.max(0, ...comparacion.evaluaciones.map((e) => e.tir.valor ?? 0))
    const tope = Math.min(100, Math.max(40, Math.ceil((maxTir + 10) / 5) * 5))
    const tasas = Array.from({ length: tope / 2 + 1 }, (_, i) => i * 2)
    return perfilVAN(
      comparacion.evaluaciones.map((e) => e.flujos.flujoNeto),
      tasas,
    ).map((fila) => ({ tasa: fila.tasa, ...Object.fromEntries(fila.vans.map((v, i) => [`p${i}`, v])) }))
  }, [comparacion])

  // Flujo descontado acumulado por año (el payback descontado es donde cruza el cero).
  const datosAcumulado = useMemo(() => {
    if (!comparacion) return []
    const maxN = Math.max(...comparacion.evaluaciones.map((e) => e.flujos.flujoNeto.length))
    return Array.from({ length: maxN }, (_, t) => {
      const fila: Record<string, number | null> = { anio: t }
      comparacion.evaluaciones.forEach((e, i) => {
        const fn = e.flujos.flujoNeto
        fila[`p${i}`] = t < fn.length ? Math.round(van(fn.slice(0, t + 1), supuestos.tmar) * 100) / 100 : null
      })
      return fila
    })
  }, [comparacion, supuestos.tmar])

  const agregarProyecto = () => {
    if (supuestos.proyectos.length >= MAX_PROYECTOS) return
    const nuevo = proyectoNuevo(`Proyecto ${supuestos.proyectos.length + 1}`)
    cambiar({ ...supuestos, proyectos: [...supuestos.proyectos, nuevo] })
    setActivo(supuestos.proyectos.length)
  }

  const quitarProyecto = (i: number) => {
    cambiar({ ...supuestos, proyectos: supuestos.proyectos.filter((_, j) => j !== i) })
    setActivo(0)
  }

  const indiceActivo = Math.min(activo, supuestos.proyectos.length - 1)
  const proyectoActivo = supuestos.proyectos.at(indiceActivo)
  const mejor = comparacion?.mejorPorVAN != null ? comparacion.evaluaciones.at(comparacion.mejorPorVAN) : null
  const mejorTir = comparacion?.mejorPorTIR != null ? comparacion.evaluaciones.at(comparacion.mejorPorTIR) : null

  return (
    <div>
      <SubMenu links={proyeccionesSubMenuLinks} />

      <div className={viewStyles.viewContainer} style={{ marginTop: 16 }}>
        <div className={viewStyles.viewHeader}>
          <h2 className={viewStyles.viewTitle}>Presupuesto de capital</h2>
        </div>

        <p className={styles.intro}>
          Compare hasta {MAX_PROYECTOS} proyectos de inversión con VAN, TIR, relación beneficio/costo y periodo de
          recuperación. Los flujos se calculan con ingresos, costos, depreciación e impuesto sobre la renta. Los cambios se
          guardan como borrador en este navegador; use Guardar para conservarlos en la base de datos.
        </p>

        <div className={styles.barra}>
          <div className={styles.campo} style={{ width: 160 }}>
            <label htmlFor="capital-tmar">TMAR (%)</label>
            <input
              id="capital-tmar"
              type="number"
              step="any"
              value={supuestos.tmar}
              onChange={(e) => cambiar({ ...supuestos, tmar: Number(e.target.value) || 0 })}
            />
          </div>
          <div className={styles.campo} style={{ width: 160 }}>
            <label htmlFor="capital-isr">Impuesto sobre la renta (%)</label>
            <input
              id="capital-isr"
              type="number"
              step="any"
              value={supuestos.impuesto}
              onChange={(e) => cambiar({ ...supuestos, impuesto: Number(e.target.value) || 0 })}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={buttonStyles.btnPrimary}
              disabled={!comparacion}
              onClick={() => comparacion && void exportarCapitalExcel(supuestos, comparacion)}
            >
              Descargar Excel
            </button>
            <BotonResumenIA tipo="capital" datos={supuestos as unknown as Record<string, unknown>} disabled={!comparacion} />
            <button
              type="button"
              className={buttonStyles.btnSecondary}
              onClick={async () => {
                const ok = await Notifier.confirm({
                  title: '¿Restablecer el ejemplo?',
                  text: 'Se reemplazarán los proyectos actuales por los del ejemplo.',
                })
                if (ok.isConfirmed) {
                  cambiar(capitalEjemplo())
                  setActivo(0)
                }
              }}
            >
              Restablecer ejemplo
            </button>
          </div>
        </div>

        <DocumentosGuardados
          recurso="evaluaciones-capital"
          tipo="evaluación"
          empresaId={empresa?.empresaId ?? null}
          datos={supuestos}
          onAbrir={(d) => {
            cambiar(d as SupuestosCapital)
            setActivo(0)
          }}
          claveLocal="anf_capital_documento_v1"
          nombreSugerido="Evaluación de proyectos"
        />

        {errores.length > 0 && (
          <div className={styles.errores} role="alert">
            Corrija estos datos para evaluar los proyectos:
            <ul>
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* --- Comparación --- */}
        {comparacion && (
          <>
            <div className={styles.tablaWrap}>
              <h4 className={styles.tablaTitulo}>Comparación de proyectos (TMAR {supuestos.tmar}%)</h4>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Indicador</th>
                    {comparacion.evaluaciones.map((e, i) => (
                      <th key={i} style={{ color: COLORES.at(i) }}>
                        {e.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Desembolso inicial</td>
                    {comparacion.evaluaciones.map((e, i) => (
                      <td key={i}>{dinero(e.desembolsoInicial)}</td>
                    ))}
                  </tr>
                  <tr className={styles.filaDestacada}>
                    <td>VAN</td>
                    {comparacion.evaluaciones.map((e, i) => (
                      <td key={i} className={e.van < 0 ? styles.negativo : undefined}>
                        {dinero(e.van)} {e.criterios.van ? '✓' : '✗'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>TIR</td>
                    {comparacion.evaluaciones.map((e, i) => (
                      <td key={i} title={e.tir.aviso ?? undefined}>
                        {e.tir.valor == null ? 'No existe' : `${e.tir.valor.toFixed(2)}%`} {e.criterios.tir ? '✓' : '✗'}
                        {e.tir.aviso && e.tir.valor != null ? ' ⚠' : ''}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Relación B/C</td>
                    {comparacion.evaluaciones.map((e, i) => (
                      <td key={i}>
                        {e.bc == null ? 'No aplica' : e.bc.toFixed(4)} {e.criterios.bc ? '✓' : '✗'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td>Payback simple</td>
                    {comparacion.evaluaciones.map((e, i) => (
                      <td key={i}>{anios(e.paybackSimple)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Payback descontado</td>
                    {comparacion.evaluaciones.map((e, i) => (
                      <td key={i}>{anios(e.paybackDescontado)}</td>
                    ))}
                  </tr>
                  {caja && (
                    <tr>
                      <td>¿Alcanza el efectivo del presupuesto {caja.anio}?</td>
                      {comparacion.evaluaciones.map((e, i) => {
                        const falta = Math.round((e.desembolsoInicial - Math.max(0, caja.excedenteDiciembre)) * 100) / 100
                        return (
                          <td key={i} className={falta > 0 ? styles.alerta : undefined}>
                            {falta > 0 ? `Faltan ${dinero(falta)}` : 'Sí alcanza'}
                          </td>
                        )
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className={styles.seccion}>
              <h3>Recomendación</h3>
              <p className={styles.ayuda} style={{ marginBottom: 6 }}>
                {mejor
                  ? `Conviene "${mejor.nombre}": tiene el mayor VAN (${dinero(mejor.van)}), es decir, es el que más valor agrega por encima de la TMAR de ${supuestos.tmar}%.`
                  : `Ningún proyecto tiene VAN positivo a una TMAR de ${supuestos.tmar}%: ninguno recupera la inversión con el rendimiento exigido.`}
              </p>
              {comparacion.conflicto && mejorTir && (
                <p className={styles.ayuda} style={{ marginBottom: 6 }}>
                  La TIR señala a &quot;{mejorTir.nombre}&quot;, pero cuando los proyectos se excluyen entre sí se decide por el VAN:
                  la TIR no considera el tamaño de la inversión.
                </p>
              )}
              {comparacion.evaluaciones
                .filter((e) => e.tir.aviso)
                .map((e) => (
                  <p key={e.nombre} className={styles.ayuda} style={{ marginBottom: 6 }}>
                    {e.nombre}: {e.tir.aviso}
                  </p>
                ))}
              <div className={styles.barra} style={{ marginBottom: 0, alignItems: 'flex-end' }}>
                <div className={styles.campo} style={{ minWidth: 260 }}>
                  <label htmlFor="capital-fuente-caja">Chequeo con el presupuesto de caja</label>
                  <select
                    id="capital-fuente-caja"
                    className={styles.celdaInput}
                    style={{ textAlign: 'left' }}
                    value={fuenteCaja}
                    onChange={(e) => void cambiarFuenteCaja(e.target.value)}
                  >
                    <option value="">Borrador de este navegador</option>
                    {presupuestosGuardados.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.nombre}
                        {d.anio ? ` (${d.anio})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <p className={styles.ayuda} style={{ margin: 0, flex: 1, minWidth: 260 }}>
                  {caja
                    ? `Presupuesto ${caja.anio} (${caja.origen}): excedente a diciembre de ${dinero(caja.excedenteDiciembre)}` +
                      (caja.financiamientoMaximo > 0
                        ? `; además, ya necesita hasta ${dinero(caja.financiamientoMaximo)} de financiamiento en ${caja.mesesConFinanciamiento.join(', ')}.`
                        : '.')
                    : 'No hay un presupuesto de caja válido: arme uno en Presupuestos para saber si el efectivo alcanza.'}
                </p>
                <button
                  type="button"
                  className={buttonStyles.btnSecondary}
                  style={{ padding: '4px 12px', fontSize: 12 }}
                  onClick={() => void cambiarFuenteCaja(fuenteCaja)}
                >
                  Actualizar
                </button>
              </div>
            </div>

            <div className={styles.grafico}>
              <h4>Perfil del VAN: dónde cruza el cero está la TIR</h4>
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={datosPerfil} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="tasa" stroke="var(--text-secondary)" unit="%" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip formatter={(v) => dinero(Number(v))} labelFormatter={(t) => `Tasa ${t}%`} />
                  <Legend />
                  <ReferenceLine y={0} stroke="var(--text-tertiary)" />
                  <ReferenceLine
                    x={Math.round(supuestos.tmar / 2) * 2}
                    stroke="var(--accent-negative)"
                    strokeDasharray="5 5"
                    label={{ value: `TMAR ${supuestos.tmar}%`, fill: 'var(--accent-negative)', fontSize: 11, position: 'top' }}
                  />
                  {comparacion.evaluaciones.map((e, i) => (
                    <Line key={i} type="monotone" dataKey={`p${i}`} name={e.nombre} stroke={COLORES.at(i)} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.grafico}>
              <h4>Flujo descontado acumulado: dónde cruza el cero se recupera la inversión</h4>
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={datosAcumulado} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="anio" stroke="var(--text-secondary)" tickFormatter={(a) => `Año ${a}`} />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip formatter={(v) => dinero(Number(v))} labelFormatter={(a) => `Año ${a}`} />
                  <Legend />
                  <ReferenceLine y={0} stroke="var(--text-tertiary)" />
                  {comparacion.evaluaciones.map((e, i) => (
                    <Line key={i} type="monotone" dataKey={`p${i}`} name={e.nombre} stroke={COLORES.at(i)} strokeWidth={2} connectNulls={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* --- Proyectos --- */}
        <div className={styles.barra}>
          <div className={tabStyles.tabContainer} style={{ marginBottom: 0 }}>
            {supuestos.proyectos.map((p, i) => (
              <button
                key={i}
                type="button"
                className={`${tabStyles.tabButton} ${indiceActivo === i ? tabStyles.active : ''}`}
                onClick={() => setActivo(i)}
              >
                {p.nombre || `Proyecto ${i + 1}`}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={buttonStyles.btnSecondary}
            onClick={agregarProyecto}
            disabled={supuestos.proyectos.length >= MAX_PROYECTOS}
          >
            Agregar proyecto
          </button>
        </div>

        {proyectoActivo && (
          <ProyectoForm
            proyecto={proyectoActivo}
            impuesto={supuestos.impuesto}
            onChange={(p) => cambiar({ ...supuestos, proyectos: supuestos.proyectos.map((x, i) => (i === indiceActivo ? p : x)) })}
            onQuitar={supuestos.proyectos.length > 1 ? () => quitarProyecto(indiceActivo) : undefined}
          />
        )}
      </div>
    </div>
  )
}

export default Capital
