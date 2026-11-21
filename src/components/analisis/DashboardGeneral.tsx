'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowClockwise, ArrowUpRight, Bank, CashStack, Cart3, ExclamationTriangle, GraphUpArrow, InfoCircle } from 'react-bootstrap-icons'
import { useAuth } from '@/context/AuthContext'
import { puedeVerPagina } from '@/lib/accesos'
import { compararDashboard, type DashboardFinanciero, type ResumenDashboard } from '@/lib/dashboard'
import { apiClient, getErrorMessage } from '@/services/api'
import buttons from '@/styles/shared/Button.module.css'
import styles from '@/styles/analisis/DashboardFinanciero.module.css'

const Graficas = dynamic(() => import('./GraficasDashboard'), { ssr: false, loading: () => <div className={styles.loading} aria-label="Cargando gráfica" /> })
const dinero = (valor: number | null) => valor === null ? 'Sin información' : (Math.abs(valor) < 0.005 ? 0 : valor).toLocaleString('es-SV', { style: 'currency', currency: 'USD' })
const numero = (valor: number) => valor.toLocaleString('es-SV', { maximumFractionDigits: 2 })
const porcentaje = (valor: number | null) => valor === null ? 'Sin información' : `${numero(valor * 100)}%`
const estados = { HISTORICO: 'Histórico importado', FINAL: 'Ejercicio cerrado', PROVISIONAL: 'Ejercicio en curso', IMPORTADO: 'Estados importados' }
const colorResultado = (valor: number | null) => valor === null || valor === 0 ? '' : valor < 0 ? styles.negative : styles.positive

function Variacion({ actual, anterior, comparable, anio, porcentaje: esPorcentaje = false, detalle }: { actual: number | null; anterior: number | null; comparable: boolean; anio?: number; porcentaje?: boolean; detalle: string }) {
  const cambio = compararDashboard(actual, anterior, comparable, esPorcentaje)
  if (!cambio) return <small>{detalle}</small>
  const valor = Math.abs(cambio.valor) < 0.005 ? 0 : cambio.valor
  const texto = cambio.unidad === 'moneda' ? dinero(valor) : `${numero(valor)}${cambio.unidad === 'puntos' ? ' pp' : '%'}`
  return <small>{valor > 0 ? '+' : ''}{texto} frente a {anio}</small>
}

function DatosHistoricos({ historico }: { historico: ResumenDashboard[] }) {
  return <details className={styles.dataDetails}><summary>Ver datos de la gráfica</summary><div className={styles.tableScroll}>
    <table className={styles.table}><caption className="visually-hidden">Evolución financiera anual en dólares</caption><thead><tr><th>Año</th><th>Ingresos netos</th><th>Costos y gastos</th><th>Resultado</th></tr></thead>
      <tbody>{historico.map(fila => <tr key={fila.anio}><th scope="row">{fila.anio}{fila.estado === 'PROVISIONAL' ? '*' : ''}</th><td>{dinero(fila.ingresos)}</td><td>{dinero(fila.costosGastos)}</td><td>{dinero(fila.utilidad)}</td></tr>)}</tbody>
    </table>
  </div></details>
}

export default function DashboardGeneral() {
  const { user } = useAuth()
  const [datos, setDatos] = useState<DashboardFinanciero | null>(null)
  const [anio, setAnio] = useState<number>()
  const [intento, setIntento] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return
      setCargando(true); setError('')
      try {
        const respuesta = await apiClient.get<DashboardFinanciero>('/dashboard', { params: anio === undefined ? undefined : { anio }, signal: controller.signal })
        if (!controller.signal.aborted) setDatos(respuesta.data)
      } catch (error) {
        if (!controller.signal.aborted) setError(getErrorMessage(error, 'No se pudo cargar el resumen financiero.'))
      } finally { if (!controller.signal.aborted) setCargando(false) }
    })
    return () => controller.abort()
  }, [anio, intento])
  const actual = datos?.seleccionado
  const anterior = datos?.anterior ?? null
  const comparable = Boolean(actual && anterior && actual.estado !== 'PROVISIONAL' && anterior.estado !== 'PROVISIONAL')
  const puede = (ruta: string) => Boolean(user && puedeVerPagina(ruta, user))
  const tarjetas = actual ? [
    { titulo: 'Ventas netas', valor: actual.ventas, anterior: anterior?.ventas ?? null, icono: Cart3, detalle: 'Ventas del ejercicio', porcentaje: false },
    { titulo: (actual.utilidad ?? 0) < 0 ? 'Pérdida del ejercicio' : 'Utilidad neta', valor: actual.utilidad, anterior: anterior?.utilidad ?? null, icono: GraphUpArrow, detalle: 'Ingresos menos costos y gastos', porcentaje: false },
    { titulo: 'Efectivo disponible', valor: actual.efectivo, anterior: anterior?.efectivo ?? null, icono: CashStack, detalle: 'Caja y bancos', porcentaje: false },
    { titulo: 'Endeudamiento', valor: actual.endeudamiento, anterior: anterior?.endeudamiento ?? null, icono: Bank, detalle: 'Pasivos respecto a los activos', porcentaje: true },
  ] : []
  return <div className={styles.dashboard}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>VISIÓN GENERAL · {datos?.empresa.nombreEmpresa ?? 'ANF'}</p><h1>Resumen financiero</h1><p className={styles.subtitle}>Resultados y situación de la empresa · Cifras en USD</p></div>
      <div className={styles.controls}>
        {Boolean(datos?.anios.length) && <label>Ejercicio<select className="form-select" aria-label="Ejercicio del resumen financiero" disabled={cargando} value={anio ?? actual?.anio ?? ''} onChange={event => setAnio(Number(event.target.value))}>{datos?.anios.map(valor => <option key={valor} value={valor}>{valor}</option>)}</select></label>}
        <button type="button" className={buttons.btnSecondary} disabled={cargando} onClick={() => setIntento(valor => valor + 1)} aria-label="Actualizar resumen financiero" title="Actualizar resumen"><ArrowClockwise size={16} aria-hidden="true" /></button>
      </div>
    </header>
    {cargando ? <div aria-busy="true"><p className={styles.subtitle} role="status">Cargando resumen financiero…</p><div className={styles.cards}>{[0,1,2,3].map(valor => <div key={valor} className={styles.loading} />)}</div></div> :
      error ? <div className={styles.empty} role="alert"><h2>No se pudo cargar el resumen</h2><p>{error}</p><button type="button" className={buttons.btnSecondary} onClick={() => setIntento(valor => valor + 1)}>Volver a intentar</button></div> :
      !actual ? <div className={styles.empty}><h2>Tu resumen financiero comienza con los estados de la empresa</h2><p>Cuando haya un balance general o un estado de resultados publicado en ANF, podrás consultar aquí sus cifras.</p>{puede('/estados-financieros') && <Link className={buttons.btnPrimary} href="/estados-financieros">Consultar estados financieros <ArrowUpRight aria-hidden="true" /></Link>}</div> : <>
        {actual.estado === 'PROVISIONAL' && <div className={styles.notice}><InfoCircle size={16} aria-hidden="true" /><p><strong>{actual.anio} es un ejercicio en curso.</strong> Las cifras corresponden a los estados enviados a ANF y pueden cambiar. Los años completos se muestran como referencia, sin variaciones porcentuales contra este ejercicio.</p></div>}
        {actual.cambiosPendientes && <div className={styles.notice}><InfoCircle size={16} aria-hidden="true" /><p>Hay movimientos contables pendientes de envío. Este resumen muestra la última información publicada en ANF.</p></div>}
        {(!actual.tieneBalance || !actual.tieneResultados) && <div className={styles.notice}><ExclamationTriangle size={16} aria-hidden="true" /><p>Falta información del {!actual.tieneBalance && !actual.tieneResultados ? 'balance general y del estado de resultados' : !actual.tieneBalance ? 'balance general' : 'estado de resultados'} de {actual.anio}. Las cifras que dependen de ella aparecen como “Sin información”.</p></div>}
        {actual.diferenciaBalance !== null && actual.diferenciaBalance !== 0 && <div className={styles.notice}><ExclamationTriangle size={16} aria-hidden="true" /><p>El balance general presenta una diferencia de <strong>{dinero(actual.diferenciaBalance)}</strong> entre activos y la suma de pasivos y patrimonio.</p></div>}
        <section className={styles.cards} aria-label="Cifras principales">
          {tarjetas.map(({ titulo, valor, anterior: previo, icono: Icono, detalle, porcentaje: esPorcentaje }, index) => <article className={styles.card} key={index}>
            <div className={styles.cardHeader}><h2>{titulo}</h2><Icono size={18} aria-hidden="true" /></div>
            <strong className={`${styles.value} ${valor === null ? styles.missing : index === 1 ? colorResultado(valor) : ''}`}>{esPorcentaje ? porcentaje(valor) : dinero(valor)}</strong>
            <Variacion actual={valor} anterior={previo} comparable={comparable} anio={anterior?.anio} porcentaje={esPorcentaje} detalle={detalle} />
          </article>)}
        </section>
        <div className={styles.row}>
          <section className={styles.panel} aria-labelledby="evolucion-title">
            <div className={styles.panelHeader}><h2 id="evolucion-title">Evolución financiera</h2><span className={styles.tag}>{datos?.historico[0]?.anio}–{actual.anio}</span></div>
            <p className={styles.subtitle}>Ingresos, costos y resultado de los años publicados</p>
            <Graficas tipo="evolucion" historico={datos?.historico ?? []} />
            {datos?.historico.some(fila => fila.estado === 'PROVISIONAL') && <p className={styles.panelNote}>* Ejercicio en curso: no representa necesariamente un año completo.</p>}
            <DatosHistoricos historico={datos?.historico ?? []} />
          </section>
          <section className={styles.panel} aria-labelledby="indicadores-title">
            <div className={styles.panelHeader}><h2 id="indicadores-title">Indicadores clave</h2>{puede('/ratios') && <Link href="/ratios">Ver indicadores <ArrowUpRight aria-hidden="true" /></Link>}</div>
            <p className={styles.subtitle}>Calculados con los estados del ejercicio {actual.anio}</p>
            <dl className={styles.indicators}>
              <div><dt>Liquidez corriente</dt><dd className={actual.liquidez === null ? styles.missing : ''}>{actual.liquidez === null ? 'Sin información' : `${numero(actual.liquidez)}×`}</dd><small>Activos corrientes / pasivos corrientes</small></div>
              <div><dt>Margen neto</dt><dd className={actual.margen === null ? styles.missing : ''}>{porcentaje(actual.margen)}</dd><small>Utilidad neta / ventas netas</small></div>
              <div><dt>Rentabilidad de activos</dt><dd className={actual.rentabilidad === null ? styles.missing : ''}>{porcentaje(actual.rentabilidad)}</dd><small>Utilidad neta / activos promedio</small></div>
            </dl>
          </section>
        </div>
        <div className={styles.summaries}>
          <section className={styles.panel} aria-labelledby="resultados-title">
            <div className={styles.panelHeader}><h2 id="resultados-title">Estado de resultados</h2><span className={styles.tag}>{actual.anio}</span></div>
            <p className={styles.subtitle}>Resumen del desempeño del ejercicio</p>
            <dl className={styles.statement}>
              <div><dt>Ingresos netos</dt><dd>{dinero(actual.ingresos)}</dd></div>
              <div><dt>Costos y gastos</dt><dd>{dinero(actual.costosGastos)}</dd></div>
              <div className={styles.result}><dt>Resultado del ejercicio</dt><dd className={colorResultado(actual.utilidad)}>{dinero(actual.utilidad)}</dd></div>
            </dl>
            <p className={styles.panelNote}>Los ingresos netos incluyen ventas y otros ingresos.</p>
          </section>
          <section className={styles.panel} aria-labelledby="patrimonio-title">
            <div className={styles.panelHeader}><h2 id="patrimonio-title">Situación patrimonial</h2><span className={styles.tag}>{estados[actual.estado]}</span></div>
            {actual.tieneBalance && <Graficas tipo="patrimonio" resumen={actual} />}
            <dl className={styles.statement}>
              <div><dt>Activos</dt><dd>{dinero(actual.activos)}</dd></div>
              <div><dt>Pasivos</dt><dd>{dinero(actual.pasivos)}</dd></div>
              <div><dt>Patrimonio</dt><dd>{dinero(actual.patrimonio)}</dd></div>
            </dl>
          </section>
        </div>
      </>}
  </div>
}
