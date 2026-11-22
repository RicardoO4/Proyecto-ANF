'use client'

import React, { useState, useRef, useEffect } from 'react'
import EmpresaFija from '@/components/shared/EmpresaFija'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import viewStyles from '@/styles/shared/View.module.css'
import tabStyles from '@/styles/proyeccion/Proyecciones.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import { CargaMasivaVentas } from '@/components/proyeccion/CargaMasivaVentas'
import { CargaManualVentas } from '@/components/proyeccion/CargaManualVentas'
import { ventaHistoricaService, type VentaHistorica } from '@/services/ventaHistoricaService'
import { Notifier } from '@/utils/Notifier'
import type { ProyeccionDTO } from '@/types'
import Link from 'next/link'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import { useDisponibilidadVentas } from '@/hooks/useDisponibilidadVentas'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const NOMBRES_MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
]

const obtenerNombreMesSolo = (fechaStr?: string, fallbackIndex: number = 0) => {
  if (fechaStr) {
    const partes = fechaStr.split('-')
    if (partes.length >= 2) {
      const mesNum = parseInt(partes[1], 10) - 1
      if (mesNum >= 0 && mesNum < 12) {
        return NOMBRES_MESES[mesNum]
      }
    }
  }
  return NOMBRES_MESES[fallbackIndex % 12]
}

const obtenerAnioDeFecha = (fechaStr?: string) => {
  if (fechaStr) {
    const partes = fechaStr.split('-')
    if (partes.length >= 1 && partes[0].length === 4) {
      return partes[0]
    }
  }
  return ''
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
  const [anioProyectado, setAnioProyectado] = useState<string>('')

  // Cargar ventas históricas reales de la BD
  const cargarHistoricoBD = async (empId: string) => {
    if (!empId) return
    try {
      const data = await ventaHistoricaService.getAllVentasPorEmpresa(parseInt(empId, 10))
      const validos = (data || []).filter((v: VentaHistorica) => v.fechaVenta && v.montoVenta > 0)
      
      if (validos.length === 0) {
        setHistoricoVentas([])
        return
      }

      const montos = validos.map((v) => Number(v.montoVenta))
      const promedio = montos.reduce((a, b) => a + b, 0) / montos.length
      const soloMensuales = validos.filter((v) => Number(v.montoVenta) < promedio * 3)

      const ordenados = soloMensuales.sort((a, b) => 
        new Date(a.fechaVenta).getTime() - new Date(b.fechaVenta).getTime()
      )
      const ultimos12 = ordenados.slice(-12)

      const mapeado = ultimos12.map((v: VentaHistorica, i: number) => ({
        mesLabel: `${obtenerNombreMesSolo(v.fechaVenta, i)} (${obtenerAnioDeFecha(v.fechaVenta)})`,
        historico: Number(Number(v.montoVenta || 0).toFixed(2))
      }))
      setHistoricoVentas(mapeado)
    } catch (err) {
      console.error('Error al obtener ventas históricas:', err)
    }
  }

  useEffect(() => {
    if (empresaSeleccionada) {
      void cargarHistoricoBD(empresaSeleccionada)
    }
  }, [empresaSeleccionada])

  // Genera los 3 métodos en paralelo
  const handleGenerarProyeccion = async () => {
    if (!empresaSeleccionada || !disponibilidad.datos?.clasica) {
      Notifier.warning('Por favor seleccione una empresa con datos históricos suficientes.')
      return
    }

    const solicitud = ++secuencia.current
    const toastId = Notifier.loading('Calculando proyecciones comparativas...')
    try {
      await cargarHistoricoBD(empresaSeleccionada)
      const empId = parseInt(empresaSeleccionada, 10)

      const [resMC, resIP, resIA] = await Promise.all([
        ventaHistoricaService.getProyeccionVentas(empId, 12, 'MINIMOS_CUADRADOS'),
        ventaHistoricaService.getProyeccionVentas(empId, 12, 'INCREMENTO_PORCENTUAL'),
        ventaHistoricaService.getProyeccionVentas(empId, 12, 'INCREMENTO_ABSOLUTO')
      ])

      if (solicitud !== secuencia.current) { Notifier.dismiss(String(toastId)); return }

      // Extraer el año proyectado del primer registro
      if (resMC.length > 0) {
        const primeraFecha = resMC[0].fechaProyectada || (resMC[0] as unknown as { fecha?: string }).fecha
        const anioExtraido = obtenerAnioDeFecha(primeraFecha)
        if (anioExtraido) setAnioProyectado(anioExtraido)
      }

      // Unificar los 3 resultados mes a mes
      const unificados: ResultadoProyeccionUnificado[] = resMC.map((pMC, index) => {
        const pIP = resIP[index] || {}
        const pIA = resIA[index] || {}

        const fechaStr = pMC.fechaProyectada || (pMC as unknown as { fecha?: string }).fecha
        const montoMC = pMC.montoProyectado ?? (pMC as unknown as { monto?: number }).monto ?? 0
        const montoIP = pIP.montoProyectado ?? (pIP as unknown as { monto?: number }).monto ?? 0
        const montoIA = pIA.montoProyectado ?? (pIA as unknown as { monto?: number }).monto ?? 0

        return {
          mesLabel: obtenerNombreMesSolo(fechaStr, index),
          minimosCuadrados: Number(Number(montoMC).toFixed(2)),
          incrementoPorcentual: Number(Number(montoIP).toFixed(2)),
          incrementoAbsoluto: Number(Number(montoIA).toFixed(2))
        }
      })

      setProyeccionesUnificadas(unificados)
      Notifier.dismiss(String(toastId))
      Notifier.success('Proyecciones unificadas correctamente.')
    } catch (error: unknown) {
      Notifier.dismiss(String(toastId))
      const err = error as { response?: { data?: { message?: string } } }
      Notifier.error(err.response?.data?.message || 'Error al generar las proyecciones.')
    }
  }

  // Prepara los datos para Recharts
  const datosGrafico = [
    ...historicoVentas.map((h) => ({
      mesLabel: h.mesLabel,
      historico: h.historico,
      minimosCuadrados: null as number | null,
      incrementoPorcentual: null as number | null,
      incrementoAbsoluto: null as number | null
    })),
    ...proyeccionesUnificadas.map((p) => ({
      mesLabel: `${p.mesLabel} ${anioProyectado}`,
      historico: null as number | null,
      minimosCuadrados: p.minimosCuadrados,
      incrementoPorcentual: p.incrementoPorcentual,
      incrementoAbsoluto: p.incrementoAbsoluto
    }))
  ]

  return (
    <div className={viewStyles.viewContainer}>

      <h1 className={viewStyles.viewTitle}>Proyección de Ventas</h1>
      <p className="mb-4">
        Este módulo permite realizar una proyección unificada de ventas a 12 meses basada en datos históricos comparando Mínimos Cuadrados, Incremento Porcentual e Incremento Absoluto.
      </p>
      {disponibilidad.error && <p role="alert">{disponibilidad.error}</p>}
      {disponibilidad.datos && <div className="alert alert-info">
        Meses reales registrados: {disponibilidad.datos.total}. Para esta proyección se necesitan doce meses consecutivos al final del histórico.
        {!disponibilidad.datos.clasica && <> Cargue los importes mensuales abajo o utilice <Link href="/proyecciones/pronostico">el pronóstico anual con los datos del balance</Link>.</>}
      </div>}

      {/* --- Selector de Empresa --- */}
      <div className="mb-3">
        <label htmlFor="empresa" className="form-label">Empresa</label>
        <EmpresaFija className="form-select" empresa={empresa} error={errorEmpresa} />
      </div>

      {/* --- Tabs para Carga Masiva / Manual --- */}
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

      {/* --- Contenido de la pestaña activa --- */}
      <div className="mt-3">
        {activeTab === 'masiva' && (
          <CargaMasivaVentas onGuardado={() => { setProyeccionesUnificadas([]); secuencia.current++; void disponibilidad.cargar(); void cargarHistoricoBD(empresaSeleccionada) }} />
        )}
        {activeTab === 'manual' && (
          <CargaManualVentas onGuardado={() => { setProyeccionesUnificadas([]); secuencia.current++; void disponibilidad.cargar(); void cargarHistoricoBD(empresaSeleccionada) }} />
        )}
      </div>

      {/* --- Botón Generar Proyección --- */}
      <div className="mt-4">
        <button
          className={buttonStyles.btnPrimary}
          onClick={handleGenerarProyeccion}
          disabled={!disponibilidad.datos?.clasica}
        >
          Generar Proyección Unificada
        </button>

        {/* --- Resultados, Gráfica Comparativa e IA --- */}
        {proyeccionesUnificadas.length > 0 && (
          <div className="mt-4">
            <h5>Resultados de la Proyección Comparativa</h5>
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

            {/* --- Gráfico Comparativo --- */}
            <div style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '20px', marginTop: '15px', marginBottom: '25px', height: '420px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="mesLabel" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip formatter={(value: any) => value !== null ? `$${Number(value).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'} />
                  <Legend />
                  
                  {historicoVentas.length > 0 && (
                    <Line type="monotone" dataKey="historico" name="Histórico" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} connectNulls />
                  )}

                  <Line type="monotone" dataKey="minimosCuadrados" name="Mínimos Cuadrados" stroke="#f97316" strokeDasharray="5 5" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="incrementoPorcentual" name="Incremento Porcentual" stroke="#8b5cf6" strokeDasharray="5 5" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                  <Line type="monotone" dataKey="incrementoAbsoluto" name="Incremento Absoluto" stroke="#eab308" strokeDasharray="5 5" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* --- Tabla Comparativa Alineada --- */}
            <div className="table-responsive">
              <table className={viewStyles.table} style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingLeft: '16px' }}>
                      Meses año {anioProyectado || '202x'}
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
                        ${p.minimosCuadrados.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        ${p.incrementoPorcentual.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        ${p.incrementoAbsoluto.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Proyecciones