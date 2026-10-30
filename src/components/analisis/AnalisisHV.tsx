'use client'

import React, { useState, useEffect } from 'react'
import { apiClient } from '@/services/api'

import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import styles from '@/styles/analisis/AnalisisHV.module.css'
import { Notifier } from '@/utils/Notifier'
import type { EmpresaResponseDTO } from '@/types'

interface LineaAnalisisHorizontal {
  codigoCuenta: string
  nombreCuenta: string
  saldoAnio1: number
  saldoAnio2: number
  variacionAbsoluta: number
  variacionRelativa: number
}

interface LineaAnalisisVertical {
  codigoCuenta: string
  nombreCuenta: string
  porcentajeVerticalAnio1: number
  porcentajeVerticalAnio2: number
}

interface ReporteInterno {
  analisisHorizontal: LineaAnalisisHorizontal[]
  analisisVertical: LineaAnalisisVertical[]
}

const formatNumber = (num: number) => {
  if (typeof num !== 'number') return num as unknown as string
  return num.toLocaleString('es-SV', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Función para formatear porcentajes
const formatPercent = (num: number) => {
  if (typeof num !== 'number') return 'N/A'
  // .toFixed(2) es correcto para porcentajes
  return `${num.toFixed(2)}%`
}

const AnalisisHV = () => {
  const [empresas, setEmpresas] = useState<EmpresaResponseDTO[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [anio1, setAnio1] = useState('')
  const [anio2, setAnio2] = useState('')
  const [aniosDisponibles, setAniosDisponibles] = useState<number[]>([])
  const [reporte, setReporte] = useState<ReporteInterno | null>(null)
  const [tipoAnalisis, setTipoAnalisis] = useState<'horizontal' | 'vertical'>('horizontal')

  // Cargar empresas
  useEffect(() => {
    apiClient
      .get('/empresas')
      .then((res) => setEmpresas(res.data))
      .catch((err) => console.error('Error al cargar empresas:', err))
  }, [])

  // Cargar años disponibles según empresa
  useEffect(() => {
    // Resetea los años y el reporte si no hay empresa seleccionada
    if (!empresaSeleccionada) {
      setAniosDisponibles([])
      setAnio1('')
      setAnio2('')
      setReporte(null)
      return
    }

    apiClient
      .get(`/estados-financieros/anios/${empresaSeleccionada}`)
      .then((res) => {
        setAniosDisponibles(res.data)
        // Resetea los años y el reporte si la empresa cambia
        setAnio1('')
        setAnio2('')
        setReporte(null)
      })
      .catch((err) => {
        console.error('Error al cargar años:', err)
        setAniosDisponibles([])
      })
  }, [empresaSeleccionada])

  const handleGenerarReporte = () => {
    if (!empresaSeleccionada || !anio1 || !anio2) return

    apiClient
      .get('/analisis/reporte-interno', {
        params: { empresaId: empresaSeleccionada, anio1, anio2 },
      })
      .then((res) => {
        setReporte(res.data)
        console.log('Reporte recibido:', res.data)
      })
      .catch((err) => {
        console.error('Error al generar reporte:', err)
        Notifier.error('Error al generar el reporte.')
        setReporte(null) // Limpia el reporte anterior si hay un error
      })
  }

  const datos: (LineaAnalisisHorizontal | LineaAnalisisVertical)[] =
    tipoAnalisis === 'horizontal'
      ? (reporte?.analisisHorizontal as LineaAnalisisHorizontal[] | undefined) || []
      : (reporte?.analisisVertical as LineaAnalisisVertical[] | undefined) || []
  const lineasHorizontales = datos as LineaAnalisisHorizontal[]
  const lineasVerticales = datos as LineaAnalisisVertical[]

  // 3. Usa la estructura y clases de tus otros componentes
  return (
    <div className={viewStyles.viewContainer}>
      {/* Encabezado de la Vista */}
      <div className={viewStyles.viewHeader}>
        <h2 className={viewStyles.viewTitle}>Análisis Comparativo Interno</h2>
      </div>

      {/* Selectores */}
      <div className={styles.filterBar}>
        <div className={styles.formControl}>
          <label htmlFor="empresa">Empresa</label>
          <select
            id="empresa"
            value={empresaSeleccionada}
            onChange={(e) => setEmpresaSeleccionada(e.target.value)}
          >
            <option value="">Seleccione una empresa</option>
            {empresas.map((e) => (
              <option key={e.empresaId} value={e.empresaId}>
                {e.nombreEmpresa}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formControl}>
          <label htmlFor="anio1">Año Base</label>
          <select
            id="anio1"
            value={anio1}
            onChange={(e) => setAnio1(e.target.value)}
            disabled={!empresaSeleccionada || aniosDisponibles.length === 0}
          >
            <option value="">Seleccione un año</option>
            {aniosDisponibles.map((anio) => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formControl}>
          <label htmlFor="anio2">Año Comparación</label>
          <select
            id="anio2"
            value={anio2}
            onChange={(e) => setAnio2(e.target.value)}
            disabled={!empresaSeleccionada || aniosDisponibles.length === 0}
          >
            <option value="">Seleccione un año</option>
            {aniosDisponibles.map((anio) => (
              <option key={anio} value={anio}>
                {anio}
              </option>
            ))}
          </select>
        </div>

        <button
          className={buttonStyles.btnPrimary}
          onClick={handleGenerarReporte}
          disabled={!empresaSeleccionada || !anio1 || !anio2}
        >
          Generar Reporte
        </button>
      </div>

      {/* Botones de vista */}
      {reporte && (
        <div className={styles.toggleBar}>
          <button
            className={`${styles.toggleButton} ${
              tipoAnalisis === 'horizontal' ? styles.toggleButtonActive : ''
            }`}
            onClick={() => setTipoAnalisis('horizontal')}
          >
            Análisis Horizontal
          </button>
          <button
            className={`${styles.toggleButton} ${
              tipoAnalisis === 'vertical' ? styles.toggleButtonActive : ''
            }`}
            onClick={() => setTipoAnalisis('vertical')}
          >
            Análisis Vertical
          </button>
        </div>
      )}

      {/* Tabla de resultados */}
      {reporte && (
        <div className="table-responsive">
          <table className={viewStyles.table}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cuenta</th>
                {tipoAnalisis === 'horizontal' ? (
                  <>
                    <th style={{ textAlign: 'right' }}>Saldo {anio1}</th>
                    <th style={{ textAlign: 'right' }}>Saldo {anio2}</th>
                    <th style={{ textAlign: 'right' }}>Variación Absoluta</th>
                    <th style={{ textAlign: 'right' }}>Variación Relativa (%)</th>
                  </>
                ) : (
                  <>
                    <th style={{ textAlign: 'right' }}>% Vertical {anio1}</th>
                    <th style={{ textAlign: 'right' }}>% Vertical {anio2}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {datos.length > 0 ? (
                datos.map((linea, i) => (
                  <tr key={i}>
                    <td>{linea.codigoCuenta}</td>
                    <td>{linea.nombreCuenta}</td>

                    {/* 5. Aplica el formato a TODOS los números */}
                    {tipoAnalisis === 'horizontal' ? (
                      <>
                        <td style={{ textAlign: 'right' }}>{formatNumber(lineasHorizontales[i].saldoAnio1)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(lineasHorizontales[i].saldoAnio2)}</td>
                        <td style={{ textAlign: 'right' }}>{formatNumber(lineasHorizontales[i].variacionAbsoluta)}</td>
                        <td style={{ textAlign: 'right' }}>{formatPercent(lineasHorizontales[i].variacionRelativa)}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ textAlign: 'right' }}>{formatPercent(lineasVerticales[i].porcentajeVerticalAnio1)}</td>
                        <td style={{ textAlign: 'right' }}>{formatPercent(lineasVerticales[i].porcentajeVerticalAnio2)}</td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={tipoAnalisis === 'horizontal' ? 6 : 4} style={{ textAlign: 'center' }}>
                    No hay datos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AnalisisHV
