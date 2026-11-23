'use client'
import { useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { useBaseFinanciera } from '@/hooks/useBaseFinanciera'
import AvisoPeriodoFinanciero from '@/components/shared/AvisoPeriodoFinanciero'
import { descomponerDupont } from '@/lib/rentabilidad'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import view from '@/styles/shared/View.module.css'
const porcentaje = (n: number | null) => n === null ? 'No significativo' : `${(n * 100).toFixed(2)}%`
export default function DupontIntegrado() {
  const { base, empresa, error, cargando, cargar } = useBaseFinanciera()
  const [margenCambio, setMargenCambio] = useState(0)
  const [rotacionCambio, setRotacionCambio] = useState(0)
  const [capitalCambio, setCapitalCambio] = useState(0)
  const d = base ? descomponerDupont(base.ventas, base.utilidad, base.activoPromedio, base.patrimonioPromedio) : null
  const significativo = Boolean(base && base.patrimonio > 0 && d?.margen !== null && d?.roe !== null)
  const escenario = d && significativo ? (d.margen ?? 0) * (1 + margenCambio / 100) * (d.rotacion ?? 0) * (1 + rotacionCambio / 100) * (d.multiplicador ?? 0) * (1 + capitalCambio / 100) : null
  const grafico = Array.from({ length: 9 }, (_, i) => {
    const cambio = -20 + i * 5, roe = (d?.roe ?? 0) * 100
    return { cambio, margen: roe * (1 + cambio / 100), rotacion: roe * (1 + cambio / 100), capital: roe * (1 + cambio / 100) }
  })
  return <div className={view.viewContainer}><h1>DuPont y sensibilidad</h1><p>{empresa?.nombreEmpresa} · Datos de los estados financieros cargados. Activos y patrimonio promedios: mismo criterio que Ratios y Evolución.</p>
    {cargando && <p role="status">Cargando…</p>}{error && <p role="alert">{error}</p>}
    {!cargando && <AvisoPeriodoFinanciero periodo={base?.periodo} />}
    {base && <><label>Año<select className="form-select mb-3" disabled={cargando} value={base.anio} onChange={e => void cargar(Number(e.target.value))}>{base.anios.map(a => <option key={a}>{a}</option>)}</select></label>
      {!base.tieneResultados && <p role="alert">No hay Estado de Resultados. Cargue ventas y costos para obtener la descomposición DuPont.</p>}
      {d && base.tieneResultados && !cargando && <><table className={view.table}><thead><tr><th>Margen neto</th><th>Rotación de activos</th><th>Multiplicador de capital</th><th>ROE</th></tr></thead><tbody><tr><td>{porcentaje(d.margen)}</td><td>{d.rotacion?.toFixed(4) ?? 'No calculable'} veces</td><td>{significativo ? d.multiplicador?.toFixed(4) : 'No significativo'} veces</td><td>{significativo ? porcentaje(d.roe) : 'No significativo: patrimonio no positivo'}</td></tr></tbody></table>
        {significativo && <><h2>Escenario de sensibilidad (curvas teóricas por factor)</h2><p>Cambios relativos de cada factor; los escenarios no modifican los estados originales.</p>{[[margenCambio, setMargenCambio, 'Margen'], [rotacionCambio, setRotacionCambio, 'Rotación'], [capitalCambio, setCapitalCambio, 'Multiplicador']] .map(([valor, setter, label]) => <label className="d-block" key={String(label)}>{String(label)}: {Number(valor)}%<input className="form-range" type="range" min={-50} max={50} value={Number(valor)} onChange={e => (setter as (n: number) => void)(Number(e.target.value))} /></label>)}<p>ROE del escenario: <strong>{porcentaje(escenario)}</strong></p>
          <ResponsiveContainer width="100%" height={300}><LineChart data={grafico}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="cambio" label={{ value: 'Cambio relativo de un factor (%)', position: 'insideBottom', offset: -5 }} /><YAxis unit="%" /><Tooltip /><Legend /><Line dataKey="margen" name="Margen" stroke="#4ebe96" /><Line dataKey="rotacion" name="Rotación" stroke="#f6b14b" strokeDasharray="5 5" /><Line dataKey="capital" name="Multiplicador" stroke="#9583ff" strokeDasharray="2 2" /></LineChart></ResponsiveContainer><p>Al variar un solo factor en el mismo porcentaje, las curvas coinciden por la identidad multiplicativa de DuPont. Esta gráfica es una sensibilidad teórica por factor; los deslizadores mostrados arriba afectan solo al ROE del escenario, no a estas curvas.</p></>}
        <BotonResumenIA tipo="dupont" datos={{ ventas: base.ventas, utilidadNeta: base.utilidad, activoTotal: base.activoPromedio, patrimonio: base.patrimonioPromedio }} disabled={!significativo} />
      </>}
    </>}
  </div>
}
