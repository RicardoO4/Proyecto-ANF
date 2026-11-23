'use client'
import { useMemo, useRef, useState } from 'react'
import { useBaseFinanciera } from '@/hooks/useBaseFinanciera'
import { generarProforma, porcentajeVariableProforma } from '@/lib/proforma'
import { REBAJAS_DEVOLUCIONES, VENTAS_BRUTAS } from '@/lib/accountCodes'
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
  const [tasaImpuesto, setTasaImpuesto] = useState(0)
  const [tasaInteres, setTasaInteres] = useState(0)
  const [codigoImpuesto, setCodigoImpuesto] = useState('')
  const [reglasBalance, setReglasBalance] = useState<Record<string, number>>({})
  const [reglasResultados, setReglasResultados] = useState<Record<string, number>>({})
  const reporteRef = useRef<HTMLDivElement>(null)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorImpresion, setErrorImpresion] = useState('')
  const ventasProyectadas = (base?.ventas ?? 0) * (1 + crecimiento / 100)
  const calculo = useMemo(() => {
    if (!base) return { resultado: null, error: '' }
    try { return { resultado: generarProforma(base, { ventasProyectadas, retencion, porcentajeVariableGastos: variable, tasaImpuesto, tasaInteresFinanciamiento: tasaInteres, codigoImpuesto, porcentajesVariablesBalance: reglasBalance, porcentajesVariablesResultados: reglasResultados }), error: '' } }
    catch (e) { return { resultado: null, error: e instanceof Error ? e.message : 'No se pudo proyectar.' } }
  }, [base, ventasProyectadas, retencion, variable, tasaImpuesto, tasaInteres, codigoImpuesto, reglasBalance, reglasResultados])
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
      <div className="row g-3 mb-4"><label className="col-md-3">Año base<select className="form-select" disabled={cargando} value={base.anio} onChange={e => { setReglasBalance({}); setReglasResultados({}); setCodigoImpuesto(''); void cargar(Number(e.target.value)) }}>{base.anios.map(a => <option key={a}>{a}</option>)}</select></label>
        <label className="col-md-3">Crecimiento de ventas (%)<input className="form-control" type="number" min={-99.99} step="any" value={crecimiento} onChange={e => setCrecimiento(Number(e.target.value))} /></label>
        <label className="col-md-3">Retención de utilidades (%)<input className="form-control" type="number" min={0} max={100} value={retencion} onChange={e => setRetencion(Number(e.target.value))} /></label>
        <label className="col-md-3">Parte variable de gastos operativos (%)<input className="form-control" type="number" min={0} max={100} value={variable} onChange={e => setVariable(Number(e.target.value))} /></label></div>
      <div className="row g-3 mb-4">
        <label className="col-md-3">Impuesto sobre utilidad (%)<input className="form-control" type="number" min={0} max={100} step="any" value={tasaImpuesto} onChange={e => setTasaImpuesto(Number(e.target.value))} /></label>
        <label className="col-md-3">Interés anual del financiamiento nuevo (%)<input className="form-control" type="number" min={0} max={99.99} step="any" value={tasaInteres} onChange={e => setTasaInteres(Number(e.target.value))} /></label>
        <label className="col-md-6">Cuenta del impuesto base que se sustituirá<select className="form-select" value={codigoImpuesto} onChange={e => setCodigoImpuesto(e.target.value)}><option value="">No hay impuesto base identificado; mostrar cálculo adicional</option>{base.resultados.filter(l => l.codigo.startsWith('4')).map(l => <option key={l.codigo} value={l.codigo}>{l.codigo} · {l.nombre}</option>)}</select></label>
      </div>
      <p>Las tasas son supuestos del escenario, no tasas legales predeterminadas. Con impuesto 0 % no se agrega un impuesto nuevo. Si el estado base ya contiene ISR, seleccione su cuenta para reemplazarlo y evitar duplicarlo.</p>
      <details className="mb-4"><summary>Ajustar comportamiento por cuenta</summary>
        <p>Saldo proyectado = parte fija + parte variable × (ventas proyectadas / ventas base). Un 0 % conserva el saldo; un 100 % lo hace proporcional a las ventas. Las ventas y devoluciones siguen siempre la meta de ventas. Los ajustes solo afectan este escenario.</p>
        {(['resultados', 'balance'] as const).map(tipo => <div key={tipo} className="table-responsive"><h2>{tipo === 'balance' ? 'Balance General' : 'Estado de Resultados'}</h2><table className={view.table}><thead><tr><th>Cuenta</th><th>Parte variable (%)</th></tr></thead><tbody>{base[tipo].map(l => {
          const reglas = tipo === 'balance' ? reglasBalance : reglasResultados
          const esVenta = tipo === 'resultados' && (l.codigo.startsWith(VENTAS_BRUTAS) || l.codigo.startsWith(REBAJAS_DEVOLUCIONES))
          const esImpuesto = tipo === 'resultados' && l.codigo === codigoImpuesto
          return <tr key={l.codigo}><td>{l.codigo} · {l.nombre}</td><td>{esImpuesto ? 'Calculado sobre utilidad' : <input aria-label={`Parte variable ${tipo} ${l.codigo}`} className="form-control" type="number" min={0} max={100} step="any" disabled={esVenta || cargando} value={reglas[l.codigo] ?? porcentajeVariableProforma(l.codigo, tipo, variable)} onChange={e => {
            const valor = Number(e.target.value)
            const actualizar = tipo === 'balance' ? setReglasBalance : setReglasResultados
            actualizar(previas => ({ ...previas, [l.codigo]: valor }))
          }} />}</td></tr>
        })}</tbody></table></div>)}
        <button type="button" className="btn btn-secondary" onClick={() => { setReglasBalance({}); setReglasResultados({}) }}>Restablecer reglas por defecto</button>
      </details>
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
          <div><dt>Impuesto sobre utilidad</dt><dd>{tasaImpuesto}%</dd></div>
          <div><dt>Interés del financiamiento nuevo</dt><dd>{tasaInteres}% anual</dd></div>
        </dl>
      </header>
      <p>Ventas proyectadas: {dinero(ventasProyectadas)}. Las tablas muestran la parte variable aplicada a cada cuenta. Por defecto, ingresos, costo de ventas, activos corrientes sin efectivo y proveedores varían con ventas; los demás saldos se mantienen, excepto la parte variable de gastos operativos configurada. Los ajustes individuales prevalecen sobre estas reglas.</p>
      <p>Impuesto: {p.tasaImpuesto}% sobre utilidad positiva antes de impuestos; no se reconoce crédito fiscal por pérdidas. {p.codigoImpuesto ? `Se sustituye el impuesto base de la cuenta ${p.codigoImpuesto}.` : 'El impuesto calculado se presenta como ajuste analítico adicional.'} Se supone pagado durante el periodo, sin generar un pasivo fiscal pendiente.</p>
      <p>Interés: {p.tasaInteresFinanciamiento}% anual sobre el financiamiento nuevo, supuesto disponible desde el inicio del año y sin amortización. El FER incorpora el efecto de esos intereses sobre el impuesto y la utilidad retenida. Los gastos financieros existentes conservan la regla indicada en su cuenta.</p>
      <p>La retención de utilidades es {retencion}%; los dividendos estimados son {dinero(p.dividendos)}. Una pérdida reduce completamente el patrimonio. Modelo de planificación: no sustituye una liquidación fiscal ni un calendario de deuda. Los ajustes analíticos no crean cuentas ni asientos.</p>
      <h2>Estado de Resultados Proforma {p.anio}</h2>
      <div className="table-responsive"><table className={view.table} data-resultados><thead><tr><th>Cuenta</th><th>Base</th><th>Variable (%)</th><th>Parte fija</th><th>Parte variable base</th><th>Proyectado</th></tr></thead><tbody>{p.resultados.map(l => <tr key={l.codigo}><td>{l.codigo} · {l.nombre}</td><td>{dinero(l.saldo)}</td><td>{l.impuestoCalculado ? 'Impuesto calculado' : `${l.porcentajeVariable}%`}</td><td>{l.impuestoCalculado ? '—' : dinero(l.fijo)}</td><td>{l.impuestoCalculado ? '—' : dinero(l.variable)}</td><td>{dinero(l.proyectado)}</td></tr>)}
        <tr><td>Intereses del financiamiento nuevo · ajuste analítico</td><td colSpan={4}>—</td><td>{dinero(p.interesesNuevos)}</td></tr>
        {!p.codigoImpuesto && <tr><td>Impuesto calculado · ajuste analítico</td><td colSpan={4}>—</td><td>{dinero(p.impuesto)}</td></tr>}
      </tbody><tfoot><tr><th>Ingresos netos de rebajas y devoluciones</th><td colSpan={5}>{dinero(p.ingresos)}</td></tr><tr><th>Costos y gastos antes del impuesto y del interés nuevo</th><td colSpan={5}>{dinero(p.gastosAntesImpuestoInteres)}</td></tr><tr><th>Utilidad antes de impuestos</th><td colSpan={5}>{dinero(p.utilidadAntesImpuestos)}</td></tr><tr><th>Impuesto sobre utilidad</th><td colSpan={5}>{dinero(p.impuesto)}</td></tr><tr><th>Total costos, gastos e impuesto</th><td colSpan={5}>{dinero(p.gastos)}</td></tr><tr><th>Utilidad neta</th><td colSpan={5}>{dinero(p.utilidad)}</td></tr></tfoot></table></div>
      <h2>Balance General Proforma {p.anio}</h2>
      <div className="table-responsive"><table className={view.table} data-balance><thead><tr><th>Cuenta</th><th>Base</th><th>Variable (%)</th><th>Antes de financiar</th><th>Saldo final</th></tr></thead><tbody>{p.balance.map(l => <tr key={l.codigo}><td>{l.codigo} · {l.nombre}</td><td>{dinero(l.saldo)}</td><td>{l.porcentajeVariable}%</td><td>{dinero(l.proyectado)}</td><td>{dinero(l.proyectado)}</td></tr>)}
        <tr><td>Utilidad retenida del periodo · patrimonio</td><td colSpan={2}>—</td><td>{dinero(p.retenida)}</td><td>{dinero(p.retenida)}</td></tr>
        <tr><td>Financiamiento nuevo · pasivo</td><td colSpan={2}>—</td><td>{dinero(0)}</td><td>{dinero(p.financiamiento)}</td></tr>
        <tr><td>Excedente incorporado a efectivo · activo</td><td colSpan={2}>—</td><td>{dinero(0)}</td><td>{dinero(p.excesoCaja)}</td></tr>
      </tbody><tfoot><tr><th>Total activos</th><td colSpan={2}>{dinero(base.activos)}</td><td>{dinero(p.activosAntesFinanciar)}</td><td>{dinero(p.activos)}</td></tr><tr><th>Total pasivos</th><td colSpan={2}>{dinero(base.pasivos)}</td><td>{dinero(p.pasivosAntesFinanciar)}</td><td>{dinero(p.pasivos)}</td></tr><tr><th>Total patrimonio</th><td colSpan={2}>{dinero(base.patrimonio)}</td><td>{dinero(p.patrimonio)}</td><td>{dinero(p.patrimonio)}</td></tr><tr><th>Comprobación activo − pasivo − patrimonio</th><td colSpan={3}>—</td><td data-proforma-diferencia>{dinero(p.diferencia)}</td></tr></tfoot></table></div>
      <p>FER antes del interés nuevo: {dinero(p.ferAntesIntereses)}. FER final: <strong>{dinero(p.fer)}</strong> · {p.fer > 0 ? 'Se necesita financiamiento adicional.' : p.fer < 0 ? 'El excedente se conserva como efectivo.' : 'No se necesita financiamiento adicional ni se genera excedente.'}</p>
      </div>
      <div className={styles.actions}><BotonResumenIA tipo="proforma" datos={{ anioBase: base.anio, crecimiento, retencion, porcentajeVariableGastos: variable, tasaImpuesto, tasaInteresFinanciamiento: tasaInteres, codigoImpuesto, porcentajesVariablesBalance: reglasBalance, porcentajesVariablesResultados: reglasResultados }} /> <button className="btn btn-secondary" disabled={imprimiendo} onClick={() => void imprimir()}>{imprimiendo ? 'Preparando reporte…' : 'Imprimir / guardar PDF'}</button></div>
      {errorImpresion && <p role="alert" className="text-danger">{errorImpresion}</p>}
    </>}
  </div>
}
