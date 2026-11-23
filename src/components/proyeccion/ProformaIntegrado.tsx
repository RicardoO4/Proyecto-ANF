'use client'
import { useMemo, useRef, useState } from 'react'
import { useBaseFinanciera } from '@/hooks/useBaseFinanciera'
import { generarProforma } from '@/lib/proforma'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import view from '@/styles/shared/View.module.css'
import styles from '@/styles/proyeccion/Proyecciones.module.css'
import { imprimirReporte } from '@/lib/imprimirReporte'
const dinero = (v: number) => v.toLocaleString('es-SV', { style: 'currency', currency: 'USD' })
export default function ProformaIntegrado() {
  const { base, empresa, error, cargando, cargar } = useBaseFinanciera(true)
  const [crecimiento, setCrecimiento] = useState(10)
  const [retencion, setRetencion] = useState(100)
  const [variable, setVariable] = useState(0)
  const reporteRef = useRef<HTMLDivElement>(null)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorImpresion, setErrorImpresion] = useState('')
  const ventasProyectadas = (base?.ventas ?? 0) * (1 + crecimiento / 100)
  const calculo = useMemo(() => {
    if (!base) return { resultado: null, error: '' }
    try { return { resultado: generarProforma(base, { ventasProyectadas, retencion, porcentajeVariableGastos: variable }), error: '' } }
    catch (e) { return { resultado: null, error: e instanceof Error ? e.message : 'No se pudo proyectar.' } }
  }, [base, ventasProyectadas, retencion, variable])
  const p = calculo.resultado
  const imprimir = async () => {
    if (!reporteRef.current || !p) return
    setImprimiendo(true); setErrorImpresion('')
    try { await imprimirReporte(reporteRef.current, `Estados proforma ${p.anio} · ${empresa?.nombreEmpresa ?? 'ANF'}`) }
    catch (error) { setErrorImpresion(error instanceof Error ? error.message : 'No se pudo imprimir el reporte.') }
    finally { setImprimiendo(false) }
  }
  return <div className={view.viewContainer}>
    <h1>Estados Proforma y financiamiento externo</h1><p>{empresa?.nombreEmpresa}</p>
    <p>La proyección anual utiliza un año base completo. Los ejercicios abiertos siguen disponibles en el análisis financiero como preliminares.</p>
    {cargando && <p role="status">Cargando estados financieros…</p>}
    {(error || calculo.error) && <p role="alert" className="text-danger">{error || calculo.error}</p>}
    {base && <>
      <div className="row g-3 mb-4"><label className="col-md-3">Año base<select className="form-select" disabled={cargando} value={base.anio} onChange={e => void cargar(Number(e.target.value))}>{base.anios.map(a => <option key={a}>{a}</option>)}</select></label>
        <label className="col-md-3">Crecimiento de ventas (%)<input className="form-control" type="number" min={-99.99} step="any" value={crecimiento} onChange={e => setCrecimiento(Number(e.target.value))} /></label>
        <label className="col-md-3">Retención de utilidades (%)<input className="form-control" type="number" min={0} max={100} value={retencion} onChange={e => setRetencion(Number(e.target.value))} /></label>
        <label className="col-md-3">Parte variable de gastos operativos (%)<input className="form-control" type="number" min={0} max={100} value={variable} onChange={e => setVariable(Number(e.target.value))} /></label></div>
    </>}
    {p && base && !cargando && <>
      <div ref={reporteRef} className={styles.report} data-proforma-report>
      <header className={styles.printHeader}>
        <h1>Estados financieros proforma {p.anio}</h1>
        <p>{empresa?.nombreEmpresa} · Año base: {base.anio} · Moneda: USD</p>
        <dl>
          <div><dt>Crecimiento de ventas</dt><dd>{crecimiento}%</dd></div>
          <div><dt>Retención de utilidades</dt><dd>{retencion}%</dd></div>
          <div><dt>Gastos operativos variables</dt><dd>{variable}%</dd></div>
          <div><dt>Ventas proyectadas</dt><dd>{dinero(ventasProyectadas)}</dd></div>
        </dl>
      </header>
      <p>Ventas proyectadas: {dinero(ventasProyectadas)}. Ingresos y costo de ventas varían con ventas. La parte restante de gastos operativos y otros costos permanece fija. Activos corrientes sin efectivo y cuentas por pagar varían con ventas; los demás saldos permanecen constantes. Una pérdida se incorpora completa al patrimonio.</p>
      <h2>Estado de Resultados Proforma {p.anio}</h2><div className="table-responsive"><table className={view.table}><thead><tr><th>Cuenta</th><th>Base</th><th>Parte fija</th><th>Parte variable base</th><th>Proyectado</th></tr></thead><tbody>{p.resultados.map(l => <tr key={l.codigo}><td>{l.codigo} · {l.nombre}</td><td>{dinero(l.saldo)}</td><td>{dinero(l.fijo)}</td><td>{dinero(l.variable)}</td><td>{dinero(l.proyectado)}</td></tr>)}</tbody><tfoot><tr><th>Ingresos</th><td colSpan={4}>{dinero(p.ingresos)}</td></tr><tr><th>Costos y gastos</th><td colSpan={4}>{dinero(p.gastos)}</td></tr><tr><th>Utilidad neta</th><td colSpan={4}>{dinero(p.utilidad)}</td></tr></tfoot></table></div>
      <h2>Balance General Proforma {p.anio}</h2><div className="table-responsive"><table className={view.table} data-balance><thead><tr><th>Cuenta</th><th>Base</th><th>Proyectado antes de financiamiento</th></tr></thead><tbody>{p.balance.map(l => <tr key={l.codigo}><td>{l.codigo} · {l.nombre}</td><td>{dinero(l.saldo)}</td><td>{dinero(l.proyectado)}</td></tr>)}<tr><td>Utilidad retenida del periodo</td><td>—</td><td>{dinero(p.retenida)}</td></tr><tr><td>Financiamiento externo requerido</td><td>—</td><td>{dinero(p.financiamiento)}</td></tr><tr><td>Excedente incorporado a efectivo</td><td>—</td><td>{dinero(p.excesoCaja)}</td></tr></tbody><tfoot><tr><th>Total activos</th><td colSpan={2}>{dinero(p.activos)}</td></tr><tr><th>Total pasivos</th><td colSpan={2}>{dinero(p.pasivos)}</td></tr><tr><th>Total patrimonio</th><td colSpan={2}>{dinero(p.patrimonio)}</td></tr><tr><th>Comprobación activo − pasivo − patrimonio</th><td colSpan={2}>{dinero(p.diferencia)}</td></tr></tfoot></table></div>
      <p>FER: <strong>{dinero(p.fer)}</strong> · {p.fer > 0 ? 'Se necesita financiamiento adicional.' : 'El excedente se conserva como efectivo.'}</p>
      </div>
      <div className={styles.actions}><BotonResumenIA tipo="proforma" datos={{ anioBase: base.anio, crecimiento, retencion, porcentajeVariableGastos: variable }} /> <button className="btn btn-secondary" disabled={imprimiendo} onClick={() => void imprimir()}>{imprimiendo ? 'Preparando reporte…' : 'Imprimir / guardar PDF'}</button></div>
      {errorImpresion && <p role="alert" className="text-danger">{errorImpresion}</p>}
    </>}
  </div>
}
