'use client'

import React, { useState, useEffect } from 'react'
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
  InputLabel,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  Box,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'

const lineColors = [
  '#207B25',
  '#0088FE',
  '#FF8042',
  '#FFBB28',
  '#8884d8',
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
  const [datosGraficos, setDatosGraficos] = useState<Record<string, string | number>[]>([])
  const [loading, setLoading] = useState(false)

  // Carga las empresas reales para el selector
  useEffect(() => {
    apiClient
      .get('/empresas')
      .then((res) => setEmpresas(res.data))
      .catch(() => Notifier.error('No se pudieron cargar las empresas.'))
  }, [])

  const handleGenerarGraficos = async () => {
    if (!empresaSel || ratiosSel.length === 0) {
      alert('Por favor, seleccione una empresa y al menos un ratio.')
      return
    }
    setLoading(true)
    setDatosGraficos([])

    try {
      // Conectado a la API real de evolución de ratios
      const resp = await apiClient.get('/analisis/evolucion-ratios', {
        params: { empresaId: empresaSel, ratios: ratiosSel },
      })
      // La API devuelve una lista de mapas Recharts: [{ anio: '2021', LIQUIDEZ_CORRIENTE: 1.5, ... }]
      setDatosGraficos(resp.data)
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      Notifier.error(err.response?.data?.message || 'Error al calcular la evolución de ratios.')
      setDatosGraficos([])
    } finally {
      setLoading(false)
    }
  }

  const handleRatioChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event
    setRatiosSel(typeof value === 'string' ? value.split(',') : value)
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
            onChange={(e) => setEmpresaSel(e.target.value)}
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
          <label>Ratios a Graficar</label>
          <FormControl fullWidth variant="outlined" size="small">
            <InputLabel id="ratio-label-id" sx={{ fontSize: '0.9rem', top: '-2px' }}>
              Ratios a Graficar
            </InputLabel>
            <Select
              labelId="ratio-label-id"
              multiple
              value={ratiosSel}
              onChange={handleRatioChange}
              input={<OutlinedInput label="Ratios a Graficar" />}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, paddingTop: '5px' }}>
                  {selected.map((value) => (
                    <Chip
                      key={value}
                      label={ratiosDisponibles.find((r) => r.value === value)?.label}
                      size="small"
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
          className={buttonStyles.btnPrimary}
          onClick={handleGenerarGraficos}
          disabled={loading}
        >
          {loading ? 'Generando...' : 'Generar'}
        </button>
      </div>

      {/* --- 6. Área de Gráficos --- */}
      {loading && <p>Calculando datos...</p>}

      {datosGraficos.length > 0 && (
        <div className={styles.graphArea}>
          {ratiosSel.map((ratioValue, index) => {
            const ratioLabel = ratiosDisponibles.find((r) => r.value === ratioValue)?.label
            return (
              <div className={styles.graphItem} key={ratioValue}>
                <h3 className={styles.graphTitle}>{ratioLabel}</h3>
                {/* ResponsiveContainer ahora tiene un contenedor padre (graphItem)
                    que define su tamaño, solucionando el problema de "angosto" */}
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={datosGraficos}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="anio" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={ratioValue}
                      // --- 7. Asigna colores de la paleta ---
                      stroke={lineColors[index % lineColors.length]}
                      strokeWidth={2}
                      name={ratioLabel}
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
