'use client'
import { useRef, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import { apiClient, getErrorMessage } from '@/services/api'
import type { PronosticoVentas } from '@/lib/pronosticos'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import view from '@/styles/shared/View.module.css'
export default function PronosticoIntegrado() {
  const [periodicidad, setPeriodicidad] = useState<'anual' | 'mensual'>('anual')
  const [periodos, setPeriodos] = useState(3)
  const [resultado, setResultado] = useState<(PronosticoVentas & { empresaId: number }) | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const secuencia = useRef(0)
  const generar = async (frecuencia = periodicidad, cantidad = periodos) => {
    const id = ++secuencia.current
    setCargando(true); setResultado(null)
    try { const { data } = await apiClient.get('/ventas-historicas/pronostico', { params: { periodicidad: frecuencia, periodos: cantidad } }); if (id === secuencia.current) { setResultado(data); setError('') } }
    catch (e) { if (id === secuencia.current) setError(getErrorMessage(e)) }
    finally { if (id === secuencia.current) setCargando(false) }
  }
  const { empresa } = useEmpresaPrincipal(() => { void generar('anual', 3) })
  const datos = resultado ? [...resultado.historico.map(h => ({ ...h, historico: h.monto })), ...resultado.proyecciones] : []
  return <div className={view.viewContainer}><h1>Pronósticos de ventas</h1><p>{empresa?.nombreEmpresa} · Histórico real, sin convertir ventas anuales en meses ni completar periodos con valores inventados.</p>
    <div className="row g-3 mb-4"><label className="col-md-4">Periodicidad<select className="form-select" value={periodicidad} onChange={e => { setPeriodicidad(e.target.value as 'anual' | 'mensual'); setResultado(null); setCargando(false); setError(''); secuencia.current++ }}><option value="anual">Anual</option><option value="mensual">Mensual</option></select></label><label className="col-md-4">Periodos a proyectar<input className="form-control" type="number" min={1} max={12} value={periodos} onChange={e => { setPeriodos(Number(e.target.value)); setResultado(null); setCargando(false); setError(''); secuencia.current++ }} /></label><div><button className="btn btn-primary" disabled={cargando || !empresa} onClick={() => void generar()}>{cargando ? 'Calculando…' : 'Generar pronóstico'}</button></div></div>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {resultado && <><p>Periodicidad del resultado: <strong>{resultado.periodicidad}</strong>. Con pocos periodos históricos, la extrapolación puede ser inestable. Las predicciones negativas se limitan a cero.</p>
      <ResponsiveContainer width="100%" height={350}><LineChart data={datos}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" /><YAxis /><Tooltip /><Legend /><Line dataKey="historico" name="Histórico" stroke="#4ebe96" /><Line dataKey="movil" name="Promedio móvil" stroke="#f6b14b" /><Line dataKey="logaritmica" name="Logarítmica" stroke="#9583ff" /><Line dataKey="cuadratica" name="Cuadrática" stroke="#e06c5a" /></LineChart></ResponsiveContainer>
      <table className={view.table}><thead><tr><th>Periodo</th><th>Promedio móvil</th><th>Logarítmica</th><th>Cuadrática</th></tr></thead><tbody>{resultado.proyecciones.map(p => <tr key={p.periodo}><td>{p.periodo}</td><td>${p.movil.toFixed(2)}</td><td>${p.logaritmica.toFixed(2)}</td><td>${p.cuadratica.toFixed(2)}</td></tr>)}</tbody></table>
      <BotonResumenIA tipo="pronostico" datos={{ empresaId: resultado.empresaId, periodicidad: resultado.periodicidad, periodos: resultado.proyecciones.length }} />
    </>}
  </div>
}
