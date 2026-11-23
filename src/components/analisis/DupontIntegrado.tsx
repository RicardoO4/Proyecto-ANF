'use client'
import { useState } from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { useBaseFinanciera } from '@/hooks/useBaseFinanciera'
import AvisoPeriodoFinanciero from '@/components/shared/AvisoPeriodoFinanciero'
import { descomponerDupont, calcularGraficoSensibilidadDupont } from '@/lib/rentabilidad'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import view from '@/styles/shared/View.module.css'

const porcentaje = (n: number | null) => (n === null ? 'No significativo' : `${(n * 100).toFixed(2)}%`)

export default function DupontIntegrado() {
  const { base, empresa, error, cargando, cargar } = useBaseFinanciera()
  const [margenCambio, setMargenCambio] = useState(0)
  const [rotacionCambio, setRotacionCambio] = useState(0)
  const [capitalCambio, setCapitalCambio] = useState(0)

  const d = base ? descomponerDupont(base.ventas, base.utilidad, base.activoPromedio, base.patrimonioPromedio) : null
  const significativo = Boolean(base && base.patrimonio > 0 && d?.margen !== null && d?.roe !== null)

  const escenario =
    d && significativo
      ? (d.margen ?? 0) * (1 + margenCambio / 100) * (d.rotacion ?? 0) * (1 + rotacionCambio / 100) * (d.multiplicador ?? 0) * (1 + capitalCambio / 100)
      : null

  const grafico = calcularGraficoSensibilidadDupont(d?.roe ?? 0, margenCambio, rotacionCambio, capitalCambio)

  return (
    <div className={view.viewContainer}>
      <h1>DuPont y sensibilidad</h1>
      <p>
        {empresa?.nombreEmpresa} · Datos de los estados financieros cargados. Activos y patrimonio promedios: mismo criterio que Ratios y Evolución.
      </p>

      {cargando && <p role="status">Cargando…</p>}
      {error && <p role="alert">{error}</p>}
      {!cargando && <AvisoPeriodoFinanciero periodo={base?.periodo} />}

      {base && (
        <>
          <label>
            Año
            <select
              className="form-select mb-3"
              disabled={cargando}
              value={base.anio}
              onChange={(e) => void cargar(Number(e.target.value))}
            >
              {base.anios.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>

          {!base.tieneResultados && (
            <p role="alert">No hay Estado de Resultados. Cargue ventas y costos para obtener la descomposición DuPont.</p>
          )}

          {d && base.tieneResultados && !cargando && (
            <>
              <table className={view.table}>
                <thead>
                  <tr>
                    <th>Margen neto</th>
                    <th>Rotación de activos</th>
                    <th>Multiplicador de capital</th>
                    <th>ROE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{porcentaje(d.margen)}</td>
                    <td>{d.rotacion?.toFixed(4) ?? 'No calculable'} veces</td>
                    <td>{significativo ? d.multiplicador?.toFixed(4) : 'No significativo'} veces</td>
                    <td>{significativo ? porcentaje(d.roe) : 'No significativo: patrimonio no positivo'}</td>
                  </tr>
                </tbody>
              </table>

              {significativo && (
                <>
                  <h2>Escenario de sensibilidad por factor</h2>
                  <p>Cambios relativos de cada factor; los escenarios no modifican los estados originales.</p>

                  {[
                    [margenCambio, setMargenCambio, 'Margen'],
                    [rotacionCambio, setRotacionCambio, 'Rotación'],
                    [capitalCambio, setCapitalCambio, 'Multiplicador'],
                  ].map(([valor, setter, label]) => (
                    <label className="d-block" key={String(label)}>
                      {String(label)}: {Number(valor)}%
                      <input
                        className="form-range"
                        type="range"
                        min={-50}
                        max={50}
                        value={Number(valor)}
                        onChange={(e) => (setter as (n: number) => void)(Number(e.target.value))}
                      />
                    </label>
                  ))}

                  <p>
                    ROE del escenario: <strong>{porcentaje(escenario)}</strong>
                  </p>

                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={grafico} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="cambio"
                        label={{ value: 'Cambio adicional de un control (puntos porcentuales)', position: 'insideBottom', offset: -10 }}
                      />
                      <YAxis unit="%" />
                      <Tooltip formatter={(value) => `${Number(value).toFixed(2)}%`} />
                      <Legend verticalAlign="top" height={36} />
                      <Line
                        type="monotone"
                        dataKey="combinado"
                        name="ROE del escenario actual"
                        stroke="#4ebe96"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="margen"
                        name="Sensibilidad Margen"
                        stroke="#f6b14b"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rotacion"
                        name="Sensibilidad Rotación"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="capital"
                        name="Sensibilidad Multiplicador"
                        stroke="#9583ff"
                        strokeWidth={2}
                        strokeDasharray="2 3"
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Cada curva añade los puntos porcentuales del eje X a un solo control y mantiene los otros dos constantes. La línea del escenario actual es la referencia. En cero todas coinciden; con controles iguales también pueden superponerse por la identidad multiplicativa de DuPont.
                  </p>
                </>
              )}

              <BotonResumenIA
                tipo="dupont"
                datos={{
                  ventas: base.ventas,
                  utilidadNeta: base.utilidad,
                  activoTotal: base.activoPromedio,
                  patrimonio: base.patrimonioPromedio,
                }}
                disabled={!significativo}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}
