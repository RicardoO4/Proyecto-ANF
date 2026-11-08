'use client'

import React, { useState, useEffect } from 'react'
import { apiClient } from '@/services/api'

import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import styles from '@/styles/analisis/AnalisisHV.module.css'
import { Notifier } from '@/utils/Notifier'
import type { EmpresaResponseDTO } from '@/types'
import { ACTIVO_TOTAL, VENTAS_NETAS, sumByPrefix } from '@/lib/accountCodes'

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
  saldoAnio1: number
  saldoAnio2: number
  tipoReporte?: 'BALANCE_GENERAL' | 'ESTADO_RESULTADOS'
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
    if (!empresaSeleccionada) return

    let cancelado = false
    apiClient
      .get(`/estados-financieros/anios/${empresaSeleccionada}`)
      .then((res) => {
        if (cancelado) return
        setAniosDisponibles(res.data)
      })
      .catch((err) => {
        if (cancelado) return
        console.error('Error al cargar años:', err)
        setAniosDisponibles([])
      })

    return () => {
      cancelado = true
    }
  }, [empresaSeleccionada])

  const handleEmpresaChange = (empresaId: string) => {
    setEmpresaSeleccionada(empresaId)
    setAniosDisponibles([])
    setAnio1('')
    setAnio2('')
    setReporte(null)
  }

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

  const lineasHorizontales: LineaAnalisisHorizontal[] =
    (reporte?.analisisHorizontal as LineaAnalisisHorizontal[] | undefined) || []
  const verticales: LineaAnalisisVertical[] =
    (reporte?.analisisVertical as LineaAnalisisVertical[] | undefined) || []
  // B3: la vista vertical se separa en dos tablas, cada una con su base
  const verticalBalance = verticales.filter((l) => l.tipoReporte !== 'ESTADO_RESULTADOS')
  const verticalResultados = verticales.filter((l) => l.tipoReporte === 'ESTADO_RESULTADOS')

  // Base del vertical: Total Activo (balance) / Ventas Netas (resultados)
  const baseDe = (lineas: LineaAnalisisVertical[], anio: 1 | 2, codes: string | string[]) => {
    const map = new Map(
      lineas.map((l) => [l.codigoCuenta, { saldo: anio === 1 ? l.saldoAnio1 : l.saldoAnio2 }]),
    )
    return sumByPrefix(map, codes)
  }
  const baseBal1 = baseDe(verticalBalance, 1, ACTIVO_TOTAL)
  const baseBal2 = baseDe(verticalBalance, 2, ACTIVO_TOTAL)
  const baseRes1 = baseDe(verticalResultados, 1, VENTAS_NETAS)
  const baseRes2 = baseDe(verticalResultados, 2, VENTAS_NETAS)

  // Tabla reutilizable para la vista vertical (B3): una por tipo de
  // reporte, cada una con su base explícita en el encabezado.
  const tablaVertical = (
    titulo: string,
    subtitulo: string,
    lineas: LineaAnalisisVertical[],
    base1: number,
    base2: number,
  ) => (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.25rem' }}>{titulo}</h3>
      <p style={{ margin: '0 0 0.5rem', color: '#666', fontSize: '0.9rem' }}>
        {subtitulo} — Base {anio1}: {formatNumber(base1)} | Base {anio2}:{' '}
        {formatNumber(base2)}
      </p>
      <div className="table-responsive">
        <table className={viewStyles.table}>
          <thead>
            <tr>
              <th>Código</th>
              <th>Cuenta</th>
              <th style={{ textAlign: 'right' }}>% Vertical {anio1}</th>
              <th style={{ textAlign: 'right' }}>% Vertical {anio2}</th>
            </tr>
          </thead>
          <tbody>
            {lineas.length > 0 ? (
              lineas.map((linea, i) => (
                <tr key={i}>
                  <td>{linea.codigoCuenta}</td>
                  <td>{linea.nombreCuenta}</td>
                  <td style={{ textAlign: 'right' }}>
                    {formatPercent(linea.porcentajeVerticalAnio1)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {formatPercent(linea.porcentajeVerticalAnio2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center' }}>
                  No hay datos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )

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
            onChange={(e) => handleEmpresaChange(e.target.value)}
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
      {reporte && tipoAnalisis === 'horizontal' && (
        <div className="table-responsive">
          <table className={viewStyles.table}>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cuenta</th>
                <th style={{ textAlign: 'right' }}>Saldo {anio1}</th>
                <th style={{ textAlign: 'right' }}>Saldo {anio2}</th>
                <th style={{ textAlign: 'right' }}>Variación Absoluta</th>
                <th style={{ textAlign: 'right' }}>Variación Relativa (%)</th>
              </tr>
            </thead>
            <tbody>
              {lineasHorizontales.length > 0 ? (
                lineasHorizontales.map((linea, i) => (
                  <tr key={i}>
                    <td>{linea.codigoCuenta}</td>
                    <td>{linea.nombreCuenta}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(linea.saldoAnio1)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(linea.saldoAnio2)}</td>
                    <td style={{ textAlign: 'right' }}>{formatNumber(linea.variacionAbsoluta)}</td>
                    <td style={{ textAlign: 'right' }}>{formatPercent(linea.variacionRelativa)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center' }}>
                    No hay datos para mostrar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* B3: vertical en dos tablas, cada una con su base */}
      {reporte && tipoAnalisis === 'vertical' && (
        <>
          {tablaVertical(
            'Balance General',
            '% sobre Total Activo',
            verticalBalance,
            baseBal1,
            baseBal2,
          )}
          {verticalResultados.length > 0 ? (
            tablaVertical(
              'Estado de Resultados',
              '% sobre Ventas Netas',
              verticalResultados,
              baseRes1,
              baseRes2,
            )
          ) : (
            <p style={{ textAlign: 'center', padding: '1rem', color: '#888' }}>
              Sin Estado de Resultados cargado para este período. El vertical de
              resultados se mostrará cuando se cargue.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default AnalisisHV
