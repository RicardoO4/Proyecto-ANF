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
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const obtenerNombreMes = (fechaStr?: string, fallbackIndex: number = 0) => {
  if (fechaStr) {
    const partes = fechaStr.split('-')
    if (partes.length >= 2) {
      const mesNum = parseInt(partes[1], 10) - 1
      if (mesNum >= 0 && mesNum < 12) return NOMBRES_MESES[mesNum]
    }
  }
  return NOMBRES_MESES[fallbackIndex % 12]
}

export const Proyecciones = () => {
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const secuencia = useRef(0)
  const [metodo, setMetodo] = useState('')
  const disponibilidad = useDisponibilidadVentas()
  const [activeTab, setActiveTab] = useState<'masiva' | 'manual'>('masiva')

  const { empresa, error: errorEmpresa } = useEmpresaPrincipal((e) =>
    setEmpresaSeleccionada(String(e.empresaId)),
  )

  const [proyecciones, setProyecciones] = useState<ProyeccionDTO[]>([])
  const [historicoVentas, setHistoricoVentas] = useState<{ mesLabel: string; historico: number }[]>([])

  // Cargar las ventas mensuales excluyendo registros de suma o totales anuales
  const cargarHistoricoBD = async (empId: string) => {
    if (!empId) return
    try {
      const data = await ventaHistoricaService.getAllVentasPorEmpresa(parseInt(empId, 10))
      
      // 1. Filtrar ventas válidas
      const validos = (data || []).filter((v: VentaHistorica) => v.fechaVenta && v.montoVenta > 0)
      
      if (validos.length === 0) {
        setHistoricoVentas([])
        return
      }

      // 2. Calcular mediana/promedio para descartar totales anuales o picos anomalos
      const montos = validos.map((v) => Number(v.montoVenta))
      const promedio = montos.reduce((a, b) => a + b, 0) / montos.length

      // Descartar cualquier registro que supere por más del triple el promedio mensual (totales anuales acumulados)
      const soloMensuales = validos.filter((v) => Number(v.montoVenta) < promedio * 3)

      // 3. Ordenar cronológicamente y tomar estrictamente los últimos 12 meses mensuales
      const ordenados = soloMensuales.sort((a, b) => 
        new Date(a.fechaVenta).getTime() - new Date(b.fechaVenta).getTime()
      )
      const ultimos12 = ordenados.slice(-12)

      const mapeado = ultimos12.map((v: VentaHistorica, i: number) => ({
        mesLabel: `${obtenerNombreMes(v.fechaVenta, i)} (Hist)`,
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

  const handleGenerarProyeccion = async () => {
    if (!empresaSeleccionada || !metodo || !disponibilidad.datos?.clasica) {
      Notifier.warning('Por favor seleccione una empresa y un método de proyección.')
      return
    }

    const solicitud = ++secuencia.current
    const toastId = Notifier.loading('Generando proyección...')
    try {
      await cargarHistoricoBD(empresaSeleccionada)

      const response = await ventaHistoricaService.getProyeccionVentas(
        parseInt(empresaSeleccionada, 10),
        12,
        metodo.toUpperCase().replace('-', '_'),
      )
      if (solicitud !== secuencia.current) { Notifier.dismiss(String(toastId)); return }
      setProyecciones(response)
      Notifier.dismiss(String(toastId))
      Notifier.success('Proyección generada correctamente.')
    } catch (error: unknown) {
      Notifier.dismiss(String(toastId))
      const err = error as { response?: { data?: { message?: string } } }
      Notifier.error(err.response?.data?.message || 'Error al generar la proyección.')
    }
  }

  // Prepara la serie continua sin solapamientos
  const datosGrafico = [
    ...historicoVentas.map((h) => ({
      mesLabel: h.mesLabel,
      historico: h.historico,
      proyectado: null as number | null
    })),
    ...proyecciones.map((p, index) => {
      const fechaStr = p.fechaProyectada || (p as unknown as { fecha?: string }).fecha
      const monto = p.montoProyectado ?? (p as unknown as { monto?: number }).monto ?? 0
      return {
        mesLabel: obtenerNombreMes(fechaStr, index),
        historico: null as number | null,
        proyectado: Number(Number(monto).toFixed(2))
      }
    })
  ]

  return (
    <div className={viewStyles.viewContainer}>

      <h1 className={viewStyles.viewTitle}>Proyección de Ventas</h1>
      <p className="mb-4">
        Este módulo permite realizar una proyección de ventas a 12 meses basada en datos históricos.
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

      {/* --- Selector de Método --- */}
      <div className="mb-3">
        <label className="form-label">Seleccione el Método de Proyección</label>
        <select
          className="form-select"
          value={metodo}
          onChange={(e) => { setMetodo(e.target.value); setProyecciones([]); secuencia.current++ }}
        >
          <option value="">Seleccione un método...</option>
          <option value="minimos-cuadrados">Mínimos Cuadrados</option>
          <option value="incremento-porcentual">Incremento Porcentual</option>
          <option value="incremento-absoluto">Incremento Absoluto</option>
        </select>
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
          <CargaMasivaVentas onGuardado={() => { setProyecciones([]); secuencia.current++; void disponibilidad.cargar(); void cargarHistoricoBD(empresaSeleccionada) }} />
        )}
        {activeTab === 'manual' && (
          <CargaManualVentas onGuardado={() => { setProyecciones([]); secuencia.current++; void disponibilidad.cargar(); void cargarHistoricoBD(empresaSeleccionada) }} />
        )}
      </div>

      {/* --- Botón Generar Proyección --- */}
      <div className="mt-4">
        <button
          className={buttonStyles.btnPrimary}
          onClick={handleGenerarProyeccion}
          disabled={!disponibilidad.datos?.clasica || !metodo}
        >
          Generar Proyección
        </button>

        {/* --- Resultados, Gráfica e IA --- */}
        {proyecciones.length > 0 && (
          <div className="mt-4">
            <h5>Resultados de la Proyección</h5>
            <div className="mb-3">
              <BotonResumenIA
                key={JSON.stringify(proyecciones)}
                tipo="proyeccion"
                datos={{
                  empresaId: Number(empresaSeleccionada),
                  metodo: metodo.toUpperCase().replace('-', '_'),
                }}
              />
            </div>

            {/* --- Gráfico Comparativo: Histórico Excel vs Proyectado --- */}
            <div style={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: '8px', padding: '20px', marginTop: '15px', marginBottom: '25px', height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={datosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                  <XAxis dataKey="mesLabel" stroke="var(--text-secondary)" />
                  <YAxis stroke="var(--text-secondary)" />
                  <Tooltip formatter={(value: any) => value !== null ? `$${Number(value).toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'} />
                  <Legend />
                  {historicoVentas.length > 0 && (
                    <Line type="monotone" dataKey="historico" name="Ventas Históricas (Excel)" stroke="var(--text-secondary)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                  )}
                  <Line type="monotone" dataKey="proyectado" name="Ventas Proyectadas" stroke="var(--fey-signal)" strokeWidth={3} dot={{ r: 4 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* --- Tabla de Resultados con Nombres de Meses --- */}
            <div className="table-responsive">
              <table className={viewStyles.table}>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Monto proyectado</th>
                  </tr>
                </thead>
                <tbody>
                  {proyecciones.map((p, i) => {
                    const fechaStr = p.fechaProyectada || (p as unknown as { fecha?: string }).fecha
                    const monto = (p.montoProyectado ?? (p as unknown as { monto?: number }).monto)
                    const nombreMes = obtenerNombreMes(fechaStr, i)
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: '500' }}>{nombreMes}</td>
                        <td>
                          {monto ? `$${monto.toLocaleString('es-SV', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                        </td>
                      </tr>
                    )
                  })}
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