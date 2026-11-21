'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useBaseFinanciera } from '@/hooks/useBaseFinanciera'
import type { BaseFinanciera } from '@/lib/baseFinanciera'
import { calcularPuntoEquilibrio, type DatosEquilibrio } from '@/lib/equilibrio'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import view from '@/styles/shared/View.module.css'

export default function EquilibrioIntegrado() {
  const { base, empresa, error, cargando, cargar } = useBaseFinanciera()

  if (!base || cargando) {
    return <div className={view.viewContainer}>
      <h1>Análisis de Punto de Equilibrio</h1>
      {cargando && <p role="status">Cargando datos contables…</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  }

  return <CalculadoraEquilibrio key={`${base.empresaId}-${base.anio}`} base={base} nombreEmpresa={empresa?.nombreEmpresa} cargar={cargar} />
}

function CalculadoraEquilibrio({ base, nombreEmpresa, cargar }: {
  base: BaseFinanciera
  nombreEmpresa?: string
  cargar: (anio?: number) => Promise<void>
}) {
  const gastosFijos = base.resultados.filter(r => r.codigo.startsWith('4102') || r.codigo.startsWith('4103')).reduce((total, r) => total + r.saldo, 0)
  const costoVentas = base.resultados.find(r => r.codigo.startsWith('4101'))?.saldo ?? 0
  const fijosIniciales = base.tieneResultados ? Number((gastosFijos > 0 ? gastosFijos : (base.costosGastos || 0)).toFixed(2)) : 0
  const variableInicial = base.tieneResultados ? Number((costoVentas > 0 ? costoVentas / 1000 : 40).toFixed(2)) : 0
  const precioInicial = base.tieneResultados ? Number((variableInicial > 0 ? variableInicial * 1.35 : 100).toFixed(2)) : 0

  const [costosFijos, setCostosFijos] = useState(fijosIniciales)
  const [precioVenta, setPrecioVenta] = useState(precioInicial)
  const [costoVariable, setCostoVariable] = useState(variableInicial)

  const [unidadesEquilibrio, setUnidadesEquilibrio] = useState<number | null>(null)
  const [ventasEquilibrio, setVentasEquilibrio] = useState<number | null>(null)
  const [datosGrafico, setDatosGrafico] = useState<DatosEquilibrio['datosGrafico']>([])

  const handleCalcular = () => {
    const resultado = calcularPuntoEquilibrio(costosFijos, precioVenta, costoVariable)
    if (!resultado) {
      alert('Ingrese valores no negativos y un precio mayor al costo variable.')
      return
    }
    setUnidadesEquilibrio(resultado.unidadesEquilibrio)
    setVentasEquilibrio(resultado.ventasEquilibrio)
    setDatosGrafico(resultado.datosGrafico)
  }

  const styles = {
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '20px' },
    card: { backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '24px' },
    label: { display: 'block', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' },
    input: { width: '100%', padding: '10px', border: '1px solid var(--border-default)', borderRadius: '4px', marginBottom: '15px', outlineColor: 'var(--fey-signal)', backgroundColor: 'transparent', color: 'var(--text-primary)' },
    button: { backgroundColor: 'var(--fey-signal)', color: 'var(--fey-white)', border: 'none', padding: '12px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', width: '100%', marginTop: '10px' },
    resultLabel: { color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase' as const, fontWeight: 'bold' },
    resultValue: { color: 'var(--text-primary)', fontSize: '32px', fontWeight: 'bold', margin: '5px 0 20px 0' },
    resultValueHighlight: { color: 'var(--fey-signal)', fontSize: '32px', fontWeight: 'bold', margin: '5px 0 20px 0' },
    chartContainer: { backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '24px', marginTop: '20px', height: '400px' }
  }

  return (
    <div className={view.viewContainer}>
      <h1>Análisis de Punto de Equilibrio</h1>
      <p>
        {nombreEmpresa} · Cálculos interactivos a partir de los costos fijos y variables de los estados financieros.
      </p>


      {base && (
        <>
          {/* Selector de año conectado a la BD */}
          <label className="d-block mb-3">
            Año:
            <select
              className="form-select mt-1"
              style={{ maxWidth: '200px' }}
              value={base.anio}
              onChange={(e) => void cargar(Number(e.target.value))}
            >
              {base.anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          {!base.tieneResultados && (
            <p role="alert">
              No hay Estado de Resultados cargado para el año {base.anio}. Se requieren los registros de costos y gastos para sugerir los saldos iniciales.
            </p>
          )}

          <div style={styles.grid}>
            {/* Formulario */}
            <div style={styles.card}>
              <label style={styles.label}>Costos Fijos Totales ($)</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={costosFijos}
                onChange={(e) => {
                  setCostosFijos(Number(e.target.value))
                  setUnidadesEquilibrio(null)
                  setVentasEquilibrio(null)
                  setDatosGrafico([])
                }}
              />

              <label style={styles.label}>Precio de Venta Unitario ($)</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={precioVenta}
                onChange={(e) => {
                  setPrecioVenta(Number(e.target.value))
                  setUnidadesEquilibrio(null)
                  setVentasEquilibrio(null)
                  setDatosGrafico([])
                }}
              />

              <label style={styles.label}>Costo Variable Unitario ($)</label>
              <input
                type="number"
                step="0.01"
                style={styles.input}
                value={costoVariable}
                onChange={(e) => {
                  setCostoVariable(Number(e.target.value))
                  setUnidadesEquilibrio(null)
                  setVentasEquilibrio(null)
                  setDatosGrafico([])
                }}
              />

              <button style={styles.button} onClick={handleCalcular}>
                Calcular y Graficar
              </button>
            </div>

            {/* Panel de Resultados e IA */}
            <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div>
                <h3 style={styles.resultLabel}>Unidades para alcanzar el equilibrio</h3>
                <p style={styles.resultValue}>
                  {unidadesEquilibrio !== null ? `${unidadesEquilibrio.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} unds` : '---'}
                </p>
              </div>
              <div>
                <h3 style={styles.resultLabel}>Ventas en dólares para el equilibrio</h3>
                <p style={styles.resultValueHighlight}>
                  {ventasEquilibrio !== null ? `$${ventasEquilibrio.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}
                </p>
              </div>

              <BotonResumenIA
                tipo="equilibrio"
                datos={{ costosFijos, precioVenta, costoVariable }}
                disabled={unidadesEquilibrio === null}
              />
            </div>
          </div>

          {/* Gráfico de Recharts */}
          {datosGrafico.length > 0 && (
            <div style={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="unidades" name="Unidades" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip formatter={(value) =>`$${Number(value || 0).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                  <Legend />
                  <Line type="monotone" dataKey="costosFijos" name="Costos Fijos" stroke="var(--text-secondary)" strokeDasharray="5 5" strokeWidth={2} />
                  <Line type="monotone" dataKey="costosTotales" name="Costos Totales" stroke="var(--text-tertiary)" strokeWidth={2} />
                  <Line type="monotone" dataKey="ventasTotales" name="Ventas Totales" stroke="var(--accent-positive)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
