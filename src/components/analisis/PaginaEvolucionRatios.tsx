'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { apiClient } from '@/services/api'
import { Notifier } from '@/utils/Notifier'
import type { EmpresaResponseDTO } from '@/types'

// --- 1. Importaciones de Estilo del Proyecto ---
import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import styles from '@/styles/analisis/EvolucionRatios.module.css'

import {
  FormControl,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Box,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'

const lineColors = [
  '#479ffa',
  '#4ebe96',
  '#ffa16c',
  '#b6d6ff',
  '#d6fe51',
]

const ratiosDisponibles = [
  { value: 'LIQUIDEZ_CORRIENTE', label: 'Liquidez Corriente' },
  { value: 'PRUEBA_ACIDA', label: 'Prueba Ácida' },
  { value: 'ENDEUDAMIENTO', label: 'Nivel de Endeudamiento' },
  { value: 'ROE', label: 'ROE (Rentabilidad sobre Patrimonio)' },
  { value: 'ROA', label: 'ROA (Rentabilidad sobre Activos)' },
]

const PaginaEvolucionRatios = () => {
  const [empresas, setEmpresas] = useState<EmpresaResponseDTO[]>([])
  const [empresaSel, setEmpresaSel] = useState('')
  const [ratiosSel, setRatiosSel] = useState<string[]>([])
  const [datosGraficos, setDatosGraficos] = useState<Record<string, string | number | null>[]>([])
  const [loading, setLoading] = useState(false)

  // Carga las empresas reales para el selector y deja valores por defecto
  // (monoempresa A4: primera empresa + los 5 ratios) para que las gráficas
  // se generen solas al entrar, sin requerir el clic en "Generar".
  useEffect(() => {
    apiClient
      .get('/empresas')
      .then((res) => {
        setEmpresas(res.data)
        if (Array.isArray(res.data) && res.data.length > 0) {
          setEmpresaSel(String(res.data[0].empresaId))
          setRatiosSel(ratiosDisponibles.map((r) => r.value))
        }
      })
      .catch(() => Notifier.error('No se pudieron cargar las empresas.'))
  }, [])

  // Secuencia de peticiones: evita que una respuesta vieja pise a la nueva
  // cuando el usuario cambia rápido de empresa o actualiza los datos.
  const requestSeq = useRef(0)

  const generarGraficos = useCallback(async (empresa: string) => {
    if (!empresa) return
    const seq = ++requestSeq.current
    setLoading(true)
    try {
      // Conservar todos los indicadores permite cambiar la selección sin
      // consultas adicionales ni desmontar las gráficas que siguen visibles.
      const resp = await apiClient.get('/analisis/evolucion-ratios', {
        params: {
          empresaId: empresa,
          ratios: ratiosDisponibles.map((ratio) => ratio.value).join(','),
        },
      })
      if (seq !== requestSeq.current) return // respuesta obsoleta
      // La API devuelve una lista de mapas Recharts: [{ anio: '2024', LIQUIDEZ_CORRIENTE: 0.36, ... }]
      setDatosGraficos(resp.data)
    } catch (error: unknown) {
      if (seq !== requestSeq.current) return
      const err = error as { response?: { data?: { message?: string } } }
      Notifier.error(err.response?.data?.message || 'Error al calcular la evolución de ratios.')
      setDatosGraficos([])
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [])

  const handleGenerarGraficos = () => {
    if (!empresaSel || ratiosSel.length === 0) {
      alert('Por favor, seleccione una empresa y al menos un ratio.')
      return
    }
    void generarGraficos(empresaSel)
  }

  // Consultar al cambiar la empresa. La selección solo filtra en memoria.
  useEffect(() => {
    if (!empresaSel) return
    const timer = setTimeout(() => {
      void generarGraficos(empresaSel)
    }, 400)
    return () => {
      clearTimeout(timer)
      requestSeq.current += 1
    }
  }, [empresaSel, generarGraficos])

  const handleEmpresaChange = (empresa: string) => {
    requestSeq.current += 1
    setEmpresaSel(empresa)
    setDatosGraficos([])
    setLoading(false)
  }

  const handleRatioChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event
    setRatiosSel(typeof value === 'string' ? value.split(',') : value)
  }

  const handleRemoveRatio = (ratio: string) => {
    setRatiosSel((seleccionados) => seleccionados.filter((item) => item !== ratio))
  }

  return (
    // --- 4. Usa el Contenedor de Vista Estándar ---
    <div className={viewStyles.viewContainer}>
      <div className={viewStyles.viewHeader}>
        <h2 className={viewStyles.viewTitle}>Evolución de Ratios Financieros</h2>
      </div>

      {/* --- 5. Usa el FilterBar (CSS Modules) --- */}
      <div className={styles.filterBar}>
        {/* Selector de Empresa */}
        <div className={styles.formControl}>
          <label htmlFor="empresa-select">Empresa</label>
          <select
            id="empresa-select"
            value={empresaSel}
            onChange={(e) => handleEmpresaChange(e.target.value)}
          >
            <option value="">Seleccione una empresa</option>
            {empresas.map((emp) => (
              <option key={emp.empresaId} value={emp.empresaId}>
                {emp.nombreEmpresa}
              </option>
            ))}
          </select>
        </div>

        {/* Selector de Ratios (Mantenemos MUI por complejidad) */}
        <div className={styles.formControl} style={{ flexGrow: 2 }}>
          <label htmlFor="ratio-select">Ratios a Graficar</label>
          <FormControl fullWidth variant="outlined" size="small">
            <Select
              id="ratio-select"
              multiple
              value={ratiosSel}
              onChange={handleRatioChange}
              input={<OutlinedInput aria-label="Ratios a Graficar" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, paddingTop: '5px' }}>
                  {selected.map((value) => (
                    <Chip
                      key={value}
                      label={ratiosDisponibles.find((r) => r.value === value)?.label}
                      size="small"
                      onDelete={(event) => {
                        event.stopPropagation()
                        handleRemoveRatio(value)
                      }}
                      deleteIcon={
                        <span
                          aria-label={`Quitar ${ratiosDisponibles.find((r) => r.value === value)?.label}`}
                          title="Quitar ratio"
                          onMouseDown={(event) => {
                            // Select abre en mousedown, antes del onDelete del Chip.
                            event.preventDefault()
                            event.stopPropagation()
                          }}
                        >
                          ×
                        </span>
                      }
                      sx={{
                        '& .MuiChip-deleteIcon': { color: '#b9c2cc' },
                        '& .MuiChip-deleteIcon:hover': { color: '#fff' },
                      }}
                    />
                  ))}
                </Box>
              )}
            >
              {ratiosDisponibles.map((ratio) => (
                <MenuItem key={ratio.value} value={ratio.value}>
                  {ratio.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>

        {/* Botón */}
        <button
          type="button"
          className={buttonStyles.btnPrimary}
          onClick={handleGenerarGraficos}
          disabled={loading}
        >
          {loading ? 'Generando...' : 'Generar'}
        </button>
      </div>

      {/* --- 6. Área de Gráficos --- */}
      {loading && <p>Calculando datos...</p>}
      {ratiosSel.length === 0 && <p>Selecciona al menos un ratio para mostrar su gráfica.</p>}

      {datosGraficos.length > 0 && (
        <div className={styles.graphArea}>
          {ratiosSel.map((ratioValue) => {
            const ratioLabel = ratiosDisponibles.find((r) => r.value === ratioValue)?.label
            return (
              <div className={styles.graphItem} key={ratioValue}>
                <h3 className={styles.graphTitle}>{ratioLabel}</h3>
                {/* ResponsiveContainer ahora tiene un contenedor padre (graphItem)
                    que define su tamaño, solucionando el problema de "angosto" */}
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datosGraficos}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                    <XAxis
                      dataKey="anio"
                      stroke="#525252"
                      tick={{ fill: '#868f97', fontSize: 11 }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      stroke="#525252"
                      tick={{ fill: '#868f97', fontSize: 11 }}
                      tickLine={false}
                    />
                    <Tooltip
                      // null = ratio no significativo (N/M), p.ej. ROE con
                      // patrimonio negativo → se muestra "N/M" en vez de número
                      formatter={(v: unknown) => (v == null ? 'N/M' : (v as number))}
                      contentStyle={{
                        background: '#191919',
                        border: '1px solid #262626',
                        borderRadius: 10,
                        color: '#ffffff',
                        fontSize: 12,
                        boxShadow: 'rgba(0, 0, 0, 0.8) 0 0 44px 0',
                      }}
                      labelStyle={{ color: '#868f97', fontSize: 11 }}
                      itemStyle={{ color: '#cccccc', fontSize: 12 }}
                      cursor={{ stroke: '#525252', strokeDasharray: '3 3' }}
                    />
                    <Legend wrapperStyle={{ color: '#cccccc', fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey={ratioValue}
                      // --- 7. Asigna colores de la paleta ---
                      stroke={lineColors[ratiosDisponibles.findIndex((ratio) => ratio.value === ratioValue)]}
                      strokeWidth={2}
                      name={ratioLabel}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default PaginaEvolucionRatios
