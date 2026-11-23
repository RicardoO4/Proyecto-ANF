'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import EmpresaFija from '@/components/shared/EmpresaFija'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import viewStyles from '@/styles/shared/View.module.css'
import tabStyles from '@/styles/proyeccion/Proyecciones.module.css'
import { CargaMasivaVentas } from '@/components/proyeccion/CargaMasivaVentas'
import { CargaManualVentas } from '@/components/proyeccion/CargaManualVentas'
import { ventaHistoricaService, type VentaHistorica } from '@/services/ventaHistoricaService'
import { formatMoney } from '@/lib/formatoMonetario'
import { Notifier } from '@/utils/Notifier'
import Link from 'next/link'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import { useDisponibilidadVentas } from '@/hooks/useDisponibilidadVentas'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { agruparVentasMensuales } from '@/lib/fuenteVentasMensuales'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'

const NOMBRES_MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

const formatearMesAnioKey = (keyYYYYMM: string) => {
  const [anio, mesStr] = keyYYYYMM.split('-')
  const m = parseInt(mesStr, 10) - 1
  return `${NOMBRES_MESES[m]} (${anio})`
}

const obtenerMesNombreSolo = (fechaStr: string | undefined, idx: number) => {
  if (!fechaStr) return NOMBRES_MESES[idx % 12]
  const partes = fechaStr.split('T')[0].split('-')
  if (partes.length >= 2) {
    const m = parseInt(partes[1], 10) - 1
    if (m >= 0 && m < 12) return NOMBRES_MESES[m]
  }
  return NOMBRES_MESES[idx % 12]
}

interface ResultadoProyeccionUnificado {
  mesLabel: string
  minimosCuadrados: number
  incrementoPorcentual: number
  incrementoAbsoluto: number
}

export const Proyecciones = () => {
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const secuencia = useRef(0)
  const disponibilidad = useDisponibilidadVentas()
  const [activeTab, setActiveTab] = useState<'masiva' | 'manual'>('masiva')

  const { empresa, error: errorEmpresa } = useEmpresaPrincipal((e) =>
    setEmpresaSeleccionada(String(e.empresaId)),
  )

  const [proyeccionesUnificadas, setProyeccionesUnificadas] = useState<ResultadoProyeccionUnificado[]>([])
  const [historicoVentas, setHistoricoVentas] = useState<{ mesLabel: string; historico: number }[]>([])
  const [escenarioSimulado, setEscenarioSimulado] = useState(false)
  const [anioProyectado, setAnioProyectado] = useState<string>('2026')

  const cargarHistoricoBD = useCallback(async (empId: string) => {
    if (!empId) return
    try {
      const data = await ventaHistoricaService.getAllVentasPorEmpresa(parseInt(empId, 10))
      const serie = agruparVentasMensuales((data || []).map((v: VentaHistorica) => ({
        fecha_venta: v.fechaVenta,
        monto_venta: Number(v.montoVenta),
        observacion: v.observacion,
      })))
      setEscenarioSimulado(serie.escenarioSimulado)
      const mapeado = serie.historico.slice(-12).map(({periodo, monto}) => ({
        mesLabel: formatearMesAnioKey(periodo),
        historico: Number(monto.toFixed(2)),
      }))

      setHistoricoVentas(mapeado)
    } catch (err) {
      console.error('Error al obtener ventas históricas:', err)
    }
  }, [])

  const generarProyeccionAuto = useCallback(async (empIdStr: string) => {
    if (!empIdStr) return
    const solicitud = ++secuencia.current
    try {
      await cargarHistoricoBD(empIdStr)
      const empId = parseInt(empIdStr, 10)

      const [resMC, resIP, resIA] = await Promise.all([
        ventaHistoricaService.getProyeccionVentas(empId, 12, 'MINIMOS_CUADRADOS'),
        ventaHistoricaService.getProyeccionVentas(empId, 12, 'INCREMENTO_PORCENTUAL'),
        ventaHistoricaService.getProyeccionVentas(empId, 12, 'INCREMENTO_ABSOLUTO')
      ])

      if (solicitud !== secuencia.current) return

      if (resMC.length > 0) {
        const primeraFecha = resMC[0].fechaProyectada || (resMC[0] as unknown as { fecha?: string }).fecha
        if (primeraFecha) {
          const partes = primeraFecha.split('T')[0].split('-')
          setAnioProyectado(partes[0] || '2026')
        }
      }

      const unificados: ResultadoProyeccionUnificado[] = resMC.map((pMC, index) => {
        const pIP = resIP[index] || {}
        const pIA = resIA[index] || {}

        const fechaStr = pMC.fechaProyectada || (pMC as unknown as { fecha?: string }).fecha
        const montoMC = pMC.montoProyectado ?? (pMC as unknown as { monto?: number }).monto ?? 0
        const montoIP = pIP.montoProyectado ?? (pIP as unknown as { monto?: number }).monto ?? 0
        const montoIA = pIA.montoProyectado ?? (pIA as unknown as { monto?: number }).monto ?? 0

        return {
          mesLabel: obtenerMesNombreSolo(fechaStr, index),
          minimosCuadrados: Number(Number(montoMC).toFixed(2)),
          incrementoPorcentual: Number(Number(montoIP).toFixed(2)),
          incrementoAbsoluto: Number(Number(montoIA).toFixed(2))
        }
      })

      setProyeccionesUnificadas(unificados)
    } catch (error) {
      console.error('Error al autogenerar proyecciones:', error)
    }
  }, [cargarHistoricoBD])

  useEffect(() => {
    if (!empresaSeleccionada) return
    const controlSolicitudes = secuencia
    const timer = setTimeout(() => { void generarProyeccionAuto(empresaSeleccionada) }, 0)
    return () => { clearTimeout(timer); controlSolicitudes.current++ }
  }, [empresaSeleccionada, generarProyeccionAuto])

  const datosGrafico = [
    ...historicoVentas.map((h, index) => ({
      mesLabel: h.mesLabel,
      historico: h.historico,
      minimosCuadrados: index === historicoVentas.length - 1 ? h.historico : null,
      incrementoPorcentual: index === historicoVentas.length - 1 ? h.historico : null,
      incrementoAbsoluto: index === historicoVentas.length - 1 ? h.historico : null
    })),
    ...proyeccionesUnificadas.map((p) => ({
      mesLabel: `${p.mesLabel} ${anioProyectado}`,
      historico: null as number | null,
      minimosCuadrados: p.minimosCuadrados,
      incrementoPorcentual: p.incrementoPorcentual,
      incrementoAbsoluto: p.incrementoAbsoluto
    }))
  ]

  const todosLosValores = datosGrafico.flatMap(d => [
    d.historico,
    d.minimosCuadrados,
    d.incrementoAbsoluto,
    d.incrementoPorcentual
  ].filter((v): v is number => v !== null && !isNaN(v)))

  const valorMin = todosLosValores.length > 0 ? Math.min(...todosLosValores) : 0
  const valorMax = todosLosValores.length > 0 ? Math.max(...todosLosValores) : 100

  const yMinDinamico = Math.max(0, Math.floor(valorMin * 0.9))
  const yMaxDinamico = Math.ceil(valorMax * 1.1)

  return (
    <div className={viewStyles.viewContainer}>
      <h1 className={viewStyles.viewTitle}>Proyección de Ventas Mensuales</h1>
      {escenarioSimulado && <p role="status">Fuente: escenario simulado mensual para práctica académica. Las ventas de inventarios y los demás registros no se incluyen en esta proyección.</p>}
      <p className="mb-4">
        Este módulo presenta la proyección comparativa de ventas a 12 meses basada en datos históricos mediante tres métodos clásicos: <strong>Mínimos Cuadrados</strong>, <strong>Incremento Porcentual</strong> e <strong>Incremento Absoluto</strong>.
      </p>

      {/* SECCIÓN 1: VISTA AUTOMÁTICA DE RESULTADOS Y GRÁFICO */}
      {proyeccionesUnificadas.length > 0 && (
        <div className="mt-2">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Proyección Comparativa para el Año {anioProyectado}</h5>
          </div>

          <div className="mb-3">
            <BotonResumenIA
              key={JSON.stringify(proyeccionesUnificadas)}
              tipo="proyeccion"
              datos={{
                empresaId: Number(empresaSeleccionada),
                metodo: 'UNIFICADO_COMPARATIVO',
                proyecciones: proyeccionesUnificadas
              }}
            />
          </div>

          <div style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '20px', marginTop: '15px', marginBottom: '25px', height: '440px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={datosGrafico} margin={{ top: 20, right: 30, left: 15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                <XAxis 
                  dataKey="mesLabel" 
                  stroke="var(--text-secondary)" 
                  interval={0}
                  angle={-30}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 11 }}
                />
                <YAxis 
                  domain={[yMinDinamico, yMaxDinamico]}
                  stroke="var(--text-secondary)"
                  tickFormatter={(v: number) => `$${Number(v).toLocaleString('es-SV', { notation: 'compact', compactDisplay: 'short' })}`}
                  width={80}
                />
                <Tooltip 
                  formatter={(value: ValueType | undefined, name: NameType | undefined) => [
                    value !== null && value !== undefined ? `$${Number(value).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---',
                    String(name ?? '')
                  ]} 
                />
                <Legend verticalAlign="top" height={36} />
                
                {historicoVentas.length > 0 && (
                  <Line 
                    type="monotone" 
                    dataKey="historico" 
                    name="Histórico" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ r: 4 }} 
                    connectNulls={false} 
                  />
                )}

                <Line 
                  type="monotone" 
                  dataKey="minimosCuadrados" 
                  name="Mínimos Cuadrados" 
                  stroke="#f97316" 
                  strokeDasharray="5 5" 
                  strokeWidth={2.5} 
                  dot={{ r: 4 }} 
                  connectNulls 
                />

                <Line 
                  type="monotone" 
                  dataKey="incrementoPorcentual" 
                  name="Incremento Porcentual" 
                  stroke="#8b5cf6" 
                  strokeDasharray="5 5" 
                  strokeWidth={2.5} 
                  dot={{ r: 4 }} 
                  connectNulls 
                />

                <Line 
                  type="monotone" 
                  dataKey="incrementoAbsoluto" 
                  name="Incremento Absoluto" 
                  stroke="#eab308" 
                  strokeDasharray="5 5" 
                  strokeWidth={2.5} 
                  dot={{ r: 4 }} 
                  connectNulls 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="table-responsive mb-5">
            <table className={viewStyles.table} style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', paddingLeft: '16px' }}>
                    Meses año {anioProyectado}
                  </th>
                  <th style={{ color: '#f97316', textAlign: 'center' }}>MÍNIMOS CUADRADOS</th>
                  <th style={{ color: '#8b5cf6', textAlign: 'center' }}>INCREMENTO PORCENTUAL</th>
                  <th style={{ color: '#eab308', textAlign: 'center' }}>INCREMENTO ABSOLUTO</th>
                </tr>
              </thead>
              <tbody>
                {proyeccionesUnificadas.map((p, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: 'left', paddingLeft: '16px', textTransform: 'lowercase', fontWeight: '500' }}>
                      {p.mesLabel}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {formatMoney(p.minimosCuadrados)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {formatMoney(p.incrementoPorcentual)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {formatMoney(p.incrementoAbsoluto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECCIÓN 2: CARGA DE ARCHIVOS / REGISTRO MANUAL PARA OTROS AÑOS (UBICADA ABAJO) */}
      <hr className="my-5" style={{ borderColor: 'var(--border-default)' }} />
      
      <div className="card p-4" style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)' }}>
        <h4 className="mb-2">Carga de Datos Históricos Adicionales</h4>
        <p className="text-muted mb-4">
          Utilice esta sección únicamente si desea cargar nuevos archivos (por ejemplo, para proyectar el año 2027 a partir de datos del 2026).
        </p>

        {disponibilidad.error && <p role="alert">{disponibilidad.error}</p>}
        {disponibilidad.datos && (
          <div className="alert alert-info mb-3">
            Meses registrados en BD: {disponibilidad.datos.total}. Para proyección mensual se requieren 12 meses.
            {!disponibilidad.datos.clasica && (
              <> Utilice <Link href="/proyecciones/pronostico">los pronósticos avanzados con periodicidad anual</Link>.</>
            )}
          </div>
        )}

        <div className="mb-3">
          <label htmlFor="empresa" className="form-label">Empresa</label>
          <EmpresaFija className="form-select" empresa={empresa} error={errorEmpresa} />
        </div>

        <div className={tabStyles.tabContainer}>
          <button
            className={`${tabStyles.tabButton} ${activeTab === 'masiva' ? tabStyles.active : ''}`}
            onClick={() => setActiveTab('masiva')}
          >
            Carga Masiva (Excel)
          </button>
          <button
            className={`${tabStyles.tabButton} ${activeTab === 'manual' ? tabStyles.active : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            Carga Manual
          </button>
        </div>

        <div className="mt-3">
          {activeTab === 'masiva' && (
            <CargaMasivaVentas onGuardado={() => { 
              secuencia.current++
              void disponibilidad.cargar()
              void generarProyeccionAuto(empresaSeleccionada)
              Notifier.success('Nuevos datos guardados y proyección actualizada.') 
            }} />
          )}
          {activeTab === 'manual' && (
            <CargaManualVentas onGuardado={() => { 
              secuencia.current++
              void disponibilidad.cargar()
              void generarProyeccionAuto(empresaSeleccionada)
              Notifier.success('Nuevos datos guardados y proyección actualizada.') 
            }} />
          )}
        </div>
      </div>
    </div>
  )
}

export default Proyecciones
