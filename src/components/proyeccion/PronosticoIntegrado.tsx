'use client'
import { useRef, useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import { apiClient, getErrorMessage } from '@/services/api'
import type { PronosticoVentas } from '@/lib/pronosticos'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import view from '@/styles/shared/View.module.css'
import Link from 'next/link'
import { useDisponibilidadVentas } from '@/hooks/useDisponibilidadVentas'
export default function PronosticoIntegrado() {
  const disponibilidad = useDisponibilidadVentas()
  const [periodicidad, setPeriodicidad] = useState<'anual' | 'mensual'>('anual')
  const [periodos, setPeriodos] = useState(3)
  const [resultado, setResultado] = useState<(PronosticoVentas & { empresaId: number; excluidos: {anio:number;motivo:string}[] }) | null>(null)
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
  const datos = resultado ? [
    ...resultado.historico.map((h, i) => ({
      periodo: h.periodo, historico: h.monto, esReal: true,
      // El último saldo real es solo el punto de enlace de las tres curvas.
      ...(i === resultado.historico.length - 1 ? { movil: h.monto, logaritmica: h.monto, cuadratica: h.monto } : {}),
    })),
    ...resultado.proyecciones.map(p => ({ ...p, historico: undefined, esReal: false })),
  ].map((fila, indice) => ({ ...fila, indice })) : []
  return <div className={view.viewContainer}><h1>Pronósticos de ventas</h1><p>{empresa?.nombreEmpresa} · Histórico real, sin convertir ventas anuales en meses ni completar periodos con valores inventados.</p>
    {disponibilidad.datos && <p>Totales anuales del balance: {disponibilidad.datos.totalesAnuales}. Meses reales: {disponibilidad.datos.total}. {periodicidad === 'mensual' && !disponibilidad.datos.avanzada && <>Se necesitan al menos tres periodos mensuales reales y consecutivos. <Link href="/proyecciones">Cargar ventas mensuales</Link>.</>}</p>}
    <div className="row g-3 mb-4"><label className="col-md-4">Periodicidad<select className="form-select" value={periodicidad} onChange={e => { setPeriodicidad(e.target.value as 'anual' | 'mensual'); setResultado(null); setCargando(false); setError(''); secuencia.current++ }}><option value="anual">Anual</option><option value="mensual">Mensual</option></select></label><label className="col-md-4">Periodos a proyectar<input className="form-control" type="number" min={1} max={12} value={periodos} onChange={e => { setPeriodos(Number(e.target.value)); setResultado(null); setCargando(false); setError(''); secuencia.current++ }} /></label><div><button className="btn btn-primary" disabled={cargando || !empresa} onClick={() => void generar()}>{cargando ? 'Calculando…' : 'Generar pronóstico'}</button></div></div>
    {error && <p role="alert" className="text-danger">{error}</p>}
    {periodicidad === 'anual' && <p>Se utilizan años completos. Los ejercicios provisionales y los años con meses faltantes se excluyen; sus avances siguen disponibles en ANF.</p>}
    {resultado && resultado.excluidos.length > 0 && <p role="status">Años excluidos: {resultado.excluidos.map(f => `${f.anio} (${f.motivo.toLowerCase()})`).join(', ')}.</p>}
    {resultado && <><p>Periodicidad del resultado: <strong>{resultado.periodicidad}</strong>. Con pocos periodos históricos, la extrapolación puede ser inestable. Las predicciones negativas se limitan a cero.</p>
      <p className="text-muted small">Línea continua: ventas reales. Líneas discontinuas: estimaciones desde el último dato real.</p>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={datos} accessibilityLayer margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
          <XAxis dataKey="indice" type="number" domain={[0, 'dataMax']} ticks={datos.map(f => f.indice)} tickFormatter={i => datos[i]?.periodo ?? ''} />
          <YAxis width={70} tickFormatter={v => Number(v).toLocaleString('es-SV', { notation: 'compact', maximumFractionDigits: 1 })} />
          <Tooltip
            contentStyle={{ background: '#191919', border: '1px solid #444', borderRadius: 8 }}
            labelFormatter={i => datos[Number(i)]?.periodo ?? ''}
            formatter={(valor, nombre, item) => item.payload?.esReal && item.dataKey !== 'historico' ? null : [Number(valor).toLocaleString('es-SV', { style: 'currency', currency: 'USD' }), nombre]}
          />
          <Legend />
          <ReferenceLine x={resultado.historico.length - 0.5} stroke="#868f97" strokeDasharray="3 3" label={{ value: 'Proyección', position: 'insideTopRight', fill: '#868f97', fontSize: 12 }} />
          <Line dataKey="movil" name="Promedio móvil" stroke="#f6b14b" strokeDasharray="6 4" strokeWidth={2} isAnimationActive={false} />
          <Line dataKey="logaritmica" name="Logarítmica" stroke="#9583ff" strokeDasharray="6 4" strokeWidth={2} isAnimationActive={false} />
          <Line dataKey="cuadratica" name="Cuadrática" stroke="#e06c5a" strokeDasharray="6 4" strokeWidth={2} isAnimationActive={false} />
          <Line dataKey="historico" name="Histórico" stroke="#4ebe96" strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="table-responsive"><table className={view.table}><thead><tr><th>Periodo</th><th>Promedio móvil</th><th>Logarítmica</th><th>Cuadrática</th></tr></thead><tbody>{resultado.proyecciones.map(p => <tr key={p.periodo}><td>{p.periodo}</td><td>${p.movil.toFixed(2)}</td><td>${p.logaritmica.toFixed(2)}</td><td>${p.cuadratica.toFixed(2)}</td></tr>)}</tbody></table></div>
      <BotonResumenIA tipo="pronostico" datos={{ empresaId: resultado.empresaId, periodicidad: resultado.periodicidad, periodos: resultado.proyecciones.length }} />
    </>}
  </div>
}
