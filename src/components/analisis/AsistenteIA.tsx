'use client'

// Asistente Financiero IA (Módulo E): resumen general, en lenguaje sencillo,
// de todos los ratios calculados de un año (Google Gemini vía
// /api/v1/analisis/asistente-ia). Cada pantalla de análisis tiene además su
// propio botón "Resumen con IA" (components/shared/BotonResumenIA.tsx).
import { useEffect, useRef, useState } from 'react'
import { asistenteService } from '@/services/asistenteService'
import { getErrorMessage } from '@/services/api'
import { Notifier } from '@/utils/Notifier'
import EmpresaFija from '@/components/shared/EmpresaFija'
import ResumenIAVista from '@/components/shared/ResumenIAVista'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import type { AsistenteRespuesta } from '@/lib/asistenteFinanciero'

import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import styles from '@/styles/analisis/AsistenteIA.module.css'

const AsistenteIA = () => {
  const [anios, setAnios] = useState<number[]>([])
  const [anio, setAnio] = useState('')
  const [cargandoAnios, setCargandoAnios] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [resultado, setResultado] = useState<AsistenteRespuesta | null>(null)
  const [error, setError] = useState('')
  const peticion = useRef(0)

  const { empresa, error: errorEmpresa } = useEmpresaPrincipal(async (e) => {
    try {
      const lista = await asistenteService.getAnios(e.empresaId)
      setAnios(lista)
      if (lista.length > 0) setAnio(String(lista[0]))
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudieron cargar los años con ratios.'))
    } finally {
      setCargandoAnios(false)
    }
  })

  useEffect(() => {
    if (errorEmpresa) Notifier.error('No se pudo cargar la empresa principal.')
  }, [errorEmpresa])

  const generar = async (forzar: boolean) => {
    if (!empresa || !anio) return
    const id = ++peticion.current
    setGenerando(true)
    setError('')
    try {
      const data = await asistenteService.interpretar(empresa.empresaId, Number(anio), forzar)
      if (id !== peticion.current) return
      setResultado(data)
    } catch (err) {
      if (id !== peticion.current) return
      setResultado(null)
      setError(getErrorMessage(err, 'No se pudo generar la explicación. Intente de nuevo.'))
    } finally {
      if (id === peticion.current) setGenerando(false)
    }
  }

  const cambiarAnio = (valor: string) => {
    peticion.current += 1
    setAnio(valor)
    setResultado(null)
    setError('')
    setGenerando(false)
  }

  return (
    <div className={viewStyles.viewContainer}>
      <div className={viewStyles.viewHeader}>
        <h2 className={viewStyles.viewTitle}>Asistente Financiero IA</h2>
      </div>

      <p className={styles.intro}>
        Explica en palabras sencillas qué dicen todos los ratios financieros de la empresa en un año: qué
        está bien, qué preocupa y qué se puede hacer. Cada pantalla de análisis tiene además su propio botón
        &quot;Resumen con IA&quot;.
      </p>

      <div className={styles.filterBar}>
        <div className={styles.formControl}>
          <label htmlFor="asistente-empresa">Empresa</label>
          <EmpresaFija id="asistente-empresa" empresa={empresa} error={errorEmpresa} />
        </div>
        <div className={styles.formControl}>
          <label htmlFor="asistente-anio">Año</label>
          <select
            id="asistente-anio"
            value={anio}
            onChange={(e) => cambiarAnio(e.target.value)}
            disabled={cargandoAnios || anios.length === 0}
          >
            {anios.length === 0 && (
              <option value="">{cargandoAnios ? 'Cargando...' : 'Sin ratios calculados'}</option>
            )}
            {anios.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.acciones}>
          <button
            type="button"
            className={buttonStyles.btnPrimary}
            onClick={() => void generar(false)}
            disabled={!empresa || !anio || generando}
          >
            {generando ? 'Generando explicación...' : 'Generar explicación'}
          </button>
          {resultado && !generando && (
            <button type="button" className={buttonStyles.btnSecondary} onClick={() => void generar(true)}>
              Volver a generar
            </button>
          )}
        </div>
      </div>

      {!cargandoAnios && anios.length === 0 && !errorEmpresa && (
        <div className={styles.mensaje}>
          Todavía no hay ratios calculados para esta empresa. Cárguelos y calcúlelos primero en el módulo
          de Ratios.
        </div>
      )}

      {generando && (
        <div className={styles.mensaje} role="status">
          El asistente está leyendo los ratios de {anio}. Puede tardar hasta 30 segundos.
        </div>
      )}

      {error && !generando && (
        <div className={styles.mensaje} role="alert">
          {error}
        </div>
      )}

      {resultado && !generando && (
        <ResumenIAVista interpretacion={resultado.interpretacion} meta={resultado}>
          <details className={styles.datos}>
            <summary>Ver los {resultado.ratios.length} ratios que usó el asistente</summary>
            <table className={viewStyles.table}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Ratio</th>
                  <th>Valor</th>
                  <th>Sector</th>
                  <th>Cumple</th>
                </tr>
              </thead>
              <tbody>
                {resultado.ratios.map((r) => (
                  <tr key={r.nombre}>
                    <td>{r.tipo}</td>
                    <td>{r.nombre}</td>
                    <td>{r.valorTexto}</td>
                    <td>{r.sectorTexto ?? '—'}</td>
                    <td className={r.cumpleSector ? styles.cumple : styles.noCumple}>
                      {r.cumpleSector == null ? '—' : r.cumpleSector ? 'Sí' : 'No'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </ResumenIAVista>
      )}
    </div>
  )
}

export default AsistenteIA
