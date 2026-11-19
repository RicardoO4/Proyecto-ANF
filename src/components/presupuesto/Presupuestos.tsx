'use client'

// Presupuestos de operación y de caja (Módulo E, E1-E2).
// Los supuestos se guardan como borrador en el navegador del usuario
// (localStorage) y se pueden descargar en Excel; no se escribe en la base.
import { useMemo, useState } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import SubMenu from '@/components/shared/SubMenu'
import EmpresaFija from '@/components/shared/EmpresaFija'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import DocumentosGuardados from '@/components/shared/DocumentosGuardados'
import { proyeccionesSubMenuLinks } from '@/config/menuConfig'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import { apiClient, getErrorMessage } from '@/services/api'
import { Notifier } from '@/utils/Notifier'
import {
  CLAVE_BORRADOR_PRESUPUESTO,
  MESES,
  N_MESES,
  calcularPresupuesto,
  proponerUnidades,
  supuestosEjemplo,
  validarSupuestos,
  type SupuestosPresupuesto,
} from '@/lib/presupuesto'
import SupuestosForm from './SupuestosForm'
import TablaMensual, { formatear } from './TablaMensual'
import { cedulaCaja, cedulasOperacion } from './cedulas'
import { exportarPresupuestoExcel } from './exportarExcel'

import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import tabStyles from '@/styles/proyeccion/Proyecciones.module.css'
import styles from '@/styles/presupuesto/Presupuestos.module.css'

const CLAVE_BORRADOR = CLAVE_BORRADOR_PRESUPUESTO
type Pestana = 'supuestos' | 'cedulas' | 'caja'

interface Sugerencia {
  historico: { anio: number; monto: number }[]
  crecimientoPorcentaje: number
  anioPresupuesto: number
  ventasPropuestas: number
}

function leerBorrador(): SupuestosPresupuesto {
  const porDefecto = supuestosEjemplo(new Date().getFullYear() + 1)
  try {
    const texto = typeof window !== 'undefined' ? window.localStorage.getItem(CLAVE_BORRADOR) : null
    if (!texto) return porDefecto
    const guardado = JSON.parse(texto) as SupuestosPresupuesto
    // Si el formato no coincide (borrador viejo o dañado), se usa el ejemplo.
    return guardado?.ventas?.unidades?.length === N_MESES ? guardado : porDefecto
  } catch {
    return porDefecto
  }
}

function guardarBorrador(s: SupuestosPresupuesto) {
  try {
    window.localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(s))
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): el presupuesto sigue funcionando.
  }
}

const dinero = (v: number) => `$${formatear(v)}`

const Presupuestos = () => {
  const [supuestos, setSupuestos] = useState<SupuestosPresupuesto>(leerBorrador)
  const [pestana, setPestana] = useState<Pestana>('supuestos')
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null)
  const [cargandoSugerencia, setCargandoSugerencia] = useState(false)
  const [crecimiento, setCrecimiento] = useState(0)
  const [pesos, setPesos] = useState<number[]>(() => Array.from({ length: N_MESES }, () => 100 / N_MESES))
  const { empresa, error: errorEmpresa } = useEmpresaPrincipal()

  const cambiar = (s: SupuestosPresupuesto) => {
    setSupuestos(s)
    guardarBorrador(s)
  }

  const errores = useMemo(() => validarSupuestos(supuestos), [supuestos])
  const presupuesto = useMemo(() => (errores.length === 0 ? calcularPresupuesto(supuestos) : null), [supuestos, errores])

  // --- Propuesta de ventas desde el histórico ---
  const pedirSugerencia = async () => {
    if (!empresa) return
    setCargandoSugerencia(true)
    try {
      const resp = await apiClient.get<Sugerencia>('/presupuestos/sugerencia', { params: { empresaId: empresa.empresaId } })
      setSugerencia(resp.data)
      setCrecimiento(resp.data.crecimientoPorcentaje)
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudieron leer las ventas históricas.'))
    } finally {
      setCargandoSugerencia(false)
    }
  }

  const ventasPropuestas = sugerencia ? (sugerencia.historico.at(-1)?.monto ?? 0) * (1 + crecimiento / 100) : 0
  const sumaPesos = Math.round(pesos.reduce((s, p) => s + p, 0) * 100) / 100

  const aplicarPropuesta = () => {
    if (!sugerencia) return
    const precio = supuestos.ventas.precioUnitario
    const unidades = proponerUnidades(ventasPropuestas, precio, pesos)
    const ultimoAnio = sugerencia.historico.at(-1)?.monto ?? 0
    cambiar({
      ...supuestos,
      anio: sugerencia.anioPresupuesto,
      ventas: {
        ...supuestos.ventas,
        unidades,
        // Enero siguiente: enero propuesto con un año más de crecimiento.
        unidadesEneroSiguiente: Math.round((unidades.at(0) ?? 0) * (1 + crecimiento / 100)),
        // Estimación: noviembre y diciembre del año anterior = promedio mensual de ese año.
        ventasNovAnterior: Math.round(ultimoAnio / 12),
        ventasDicAnterior: Math.round(ultimoAnio / 12),
      },
    })
    Notifier.success('Ventas propuestas aplicadas. Revise y ajuste lo que necesite.')
  }

  const panelPropuesta = (
    <div className={styles.seccion} style={{ background: 'var(--surface-card)' }}>
      <div className={styles.barra} style={{ marginBottom: sugerencia ? 14 : 0 }}>
        <button type="button" className={buttonStyles.btnSecondary} onClick={() => void pedirSugerencia()} disabled={!empresa || cargandoSugerencia}>
          {cargandoSugerencia ? 'Leyendo ventas...' : 'Proponer desde ventas históricas'}
        </button>
        {sugerencia && (
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            Histórico: {sugerencia.historico.map((h) => `${h.anio}: ${dinero(h.monto)}`).join(' · ')}
          </span>
        )}
      </div>
      {sugerencia && (
        <>
          <div className={styles.campos}>
            <div className={styles.campo}>
              <label>Crecimiento anual (%)</label>
              <input type="number" step="any" value={crecimiento} onChange={(e) => setCrecimiento(Number(e.target.value) || 0)} />
            </div>
            <div className={styles.campo}>
              <label>Ventas propuestas {sugerencia.anioPresupuesto}</label>
              <input value={dinero(ventasPropuestas)} readOnly />
            </div>
            <div className={styles.campo}>
              <label>Precio unitario usado</label>
              <input value={dinero(supuestos.ventas.precioUnitario)} readOnly />
            </div>
          </div>
          <p className={styles.ayuda} style={{ marginTop: 14 }}>
            Estacionalidad: % de las ventas del año en cada mes. <span className={Math.abs(sumaPesos - 100) <= 0.01 ? styles.sumaOk : styles.sumaMal}>Suman {sumaPesos}%</span>
          </p>
          <div className={styles.tablaWrap}>
            <table className={styles.tabla}>
              <tbody>
                <tr>
                  <td>% del año</td>
                  {pesos.map((p, i) => (
                    <td key={MESES.at(i)}>
                      <input
                        className={styles.celdaInput}
                        type="number"
                        step="any"
                        value={Math.round(p * 100) / 100}
                        onChange={(e) => setPesos(pesos.map((x, j) => (j === i ? Number(e.target.value) || 0 : x)))}
                        aria-label={`Estacionalidad ${MESES.at(i)}`}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" className={buttonStyles.btnPrimary} onClick={aplicarPropuesta} disabled={!(supuestos.ventas.precioUnitario > 0)}>
            Aplicar a las unidades del presupuesto
          </button>
        </>
      )}
    </div>
  )

  const datosGrafico = presupuesto
    ? MESES.map((mes, i) => ({
        mes,
        flujoNeto: presupuesto.caja.flujoNeto.at(i) ?? 0,
        efectivoFinal: presupuesto.caja.efectivoFinal.at(i) ?? 0,
      }))
    : []

  const r = presupuesto?.resumen

  return (
    <div>
      <SubMenu links={proyeccionesSubMenuLinks} />

      <div className={viewStyles.viewContainer} style={{ marginTop: 16 }}>
        <div className={viewStyles.viewHeader}>
          <h2 className={viewStyles.viewTitle}>Presupuestos de operación y caja</h2>
        </div>

        <p className={styles.intro}>
          Presupuesto maestro de 12 meses para una empresa manufacturera: ventas, producción, materia prima,
          mano de obra directa, CIF, gastos y presupuesto de caja con cobros a 30 y 60 días. Los cambios se
          guardan como borrador en este navegador; use Guardar para conservarlo en la base de datos o descárguelo en Excel.
        </p>

        <div className={styles.barra}>
          <div className={styles.campo} style={{ minWidth: 220 }}>
            <label htmlFor="presupuesto-empresa">Empresa</label>
            <EmpresaFija id="presupuesto-empresa" empresa={empresa} error={errorEmpresa} />
          </div>
          <div className={styles.campo} style={{ width: 120 }}>
            <label htmlFor="presupuesto-anio">Año</label>
            <input
              id="presupuesto-anio"
              type="number"
              value={supuestos.anio}
              onChange={(e) => cambiar({ ...supuestos, anio: Number(e.target.value) || supuestos.anio })}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-end', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={buttonStyles.btnPrimary}
              disabled={!presupuesto}
              onClick={() => presupuesto && void exportarPresupuestoExcel(supuestos, presupuesto)}
            >
              Descargar Excel
            </button>
            <BotonResumenIA tipo="presupuesto" datos={supuestos as unknown as Record<string, unknown>} disabled={!presupuesto} />
            <button
              type="button"
              className={buttonStyles.btnSecondary}
              onClick={async () => {
                const ok = await Notifier.confirm({
                  title: '¿Restablecer el ejemplo?',
                  text: 'Se reemplazarán los supuestos actuales por los del ejemplo.',
                })
                if (ok.isConfirmed) cambiar(supuestosEjemplo(supuestos.anio))
              }}
            >
              Restablecer ejemplo
            </button>
          </div>
        </div>

        <DocumentosGuardados
          recurso="presupuestos"
          tipo="presupuesto"
          empresaId={empresa?.empresaId ?? null}
          datos={supuestos}
          onAbrir={(d) => cambiar(d as SupuestosPresupuesto)}
          claveLocal="anf_presupuesto_documento_v1"
          nombreSugerido={`Presupuesto ${supuestos.anio}`}
        />

        {errores.length > 0 && (
          <div className={styles.errores} role="alert">
            Corrija estos supuestos para calcular el presupuesto:
            <ul>
              {errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {r && (
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <span>Ventas del año</span>
              <strong>{dinero(r.ventasAnuales)}</strong>
            </div>
            <div className={styles.kpi}>
              <span>Flujo neto del año</span>
              <strong className={r.flujoNetoAnual < 0 ? styles.negativo : undefined}>{dinero(r.flujoNetoAnual)}</strong>
            </div>
            <div className={styles.kpi}>
              <span>Efectivo final (dic.)</span>
              <strong className={r.efectivoFinalAnual < 0 ? styles.negativo : undefined}>{dinero(r.efectivoFinalAnual)}</strong>
            </div>
            <div className={`${styles.kpi} ${r.financiamientoMaximo > 0 ? styles.kpiAlerta : ''}`}>
              <span>Financiamiento máximo</span>
              <strong>{dinero(r.financiamientoMaximo)}</strong>
            </div>
            <div className={`${styles.kpi} ${r.mesesConFinanciamiento.length > 0 ? styles.kpiAlerta : ''}`}>
              <span>Meses bajo el mínimo</span>
              <strong>
                {r.mesesConFinanciamiento.length === 0
                  ? 'Ninguno'
                  : r.mesesConFinanciamiento.map((m) => MESES.at(m)).join(', ')}
              </strong>
            </div>
          </div>
        )}

        <div className={tabStyles.tabContainer}>
          {(
            [
              ['supuestos', 'Supuestos'],
              ['cedulas', 'Cédulas 1 a 6'],
              ['caja', 'Presupuesto de caja'],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              className={`${tabStyles.tabButton} ${pestana === id ? tabStyles.active : ''}`}
              onClick={() => setPestana(id)}
            >
              {texto}
            </button>
          ))}
        </div>

        {pestana === 'supuestos' && <SupuestosForm supuestos={supuestos} onChange={cambiar} panelPropuesta={panelPropuesta} />}

        {pestana === 'cedulas' &&
          (presupuesto ? (
            cedulasOperacion(presupuesto).map((c) => <TablaMensual key={c.hoja} titulo={c.titulo} filas={c.filas} />)
          ) : (
            <p className={styles.ayuda}>Corrija los supuestos para ver las cédulas.</p>
          ))}

        {pestana === 'caja' &&
          (presupuesto ? (
            <>
              <div className={styles.grafico}>
                <h4>Efectivo final frente al saldo mínimo</h4>
                <ResponsiveContainer width="100%" height="88%">
                  <ComposedChart data={datosGrafico} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                    <XAxis dataKey="mes" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip formatter={(v) => dinero(Number(v))} />
                    <Legend />
                    <Bar dataKey="flujoNeto" name="Flujo neto" fill="var(--fey-graphite)" />
                    <Line type="monotone" dataKey="efectivoFinal" name="Efectivo final" stroke="var(--fey-signal)" strokeWidth={2} />
                    <ReferenceLine
                      y={supuestos.caja.saldoMinimo}
                      stroke="var(--accent-negative)"
                      strokeDasharray="5 5"
                      label={{ value: 'Saldo mínimo', fill: 'var(--accent-negative)', fontSize: 11, position: 'insideTopRight' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <TablaMensual titulo={cedulaCaja(presupuesto).titulo} filas={cedulaCaja(presupuesto).filas} />
            </>
          ) : (
            <p className={styles.ayuda}>Corrija los supuestos para ver el presupuesto de caja.</p>
          ))}
      </div>
    </div>
  )
}

export default Presupuestos
