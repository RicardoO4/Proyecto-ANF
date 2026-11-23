'use client'

// Botón "Resumen con IA" (Módulo E). Se coloca en cada pantalla de análisis;
// al pulsarlo pide a /api/v1/resumen-ia la explicación de ESE análisis y la
// muestra en una ventana. Para ahorrar tokens, mientras los datos no cambien
// reutiliza el último resumen sin volver a llamar al servidor.
import { useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { Stars } from 'react-bootstrap-icons'
import { apiClient, getErrorMessage } from '@/services/api'
import ResumenIAVista from '@/components/shared/ResumenIAVista'
import type { ResumenIARespuesta, TipoResumen } from '@/lib/resumenIA'

import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import styles from '@/styles/analisis/AsistenteIA.module.css'

interface Props {
  tipo: TipoResumen
  /** Parámetros de la pantalla (los mismos con que se hizo el análisis). */
  datos: Record<string, unknown>
  /** Desactiva el botón mientras el análisis no esté listo. */
  disabled?: boolean
  etiqueta?: string
}

const BotonResumenIA = ({ tipo, datos, disabled = false, etiqueta = 'Resumen con IA' }: Props) => {
  const [abierto, setAbierto] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [resultado, setResultado] = useState<ResumenIARespuesta | null>(null)
  const [error, setError] = useState('')
  const ultimaClave = useRef('')
  const peticion = useRef(0)

  const pedir = async (forzar: boolean) => {
    const clave = JSON.stringify({ tipo, datos })
    // Mismos datos y ya hay resumen: se muestra sin llamar al servidor.
    if (!forzar && resultado && ultimaClave.current === clave) return

    const id = ++peticion.current
    setCargando(true)
    setError('')
    try {
      const resp = await apiClient.post<ResumenIARespuesta>(
        '/resumen-ia',
        { tipo, datos, forzar },
        { timeout: 60_000 },
      )
      if (id !== peticion.current) return
      ultimaClave.current = clave
      setResultado(resp.data)
    } catch (err) {
      if (id !== peticion.current) return
      setResultado(null)
      setError(getErrorMessage(err, 'No se pudo generar el resumen. Intente de nuevo.'))
    } finally {
      if (id === peticion.current) setCargando(false)
    }
  }

  const abrir = () => {
    setAbierto(true)
    void pedir(false)
  }

  return (
    <>
      <button
        type="button"
        className={buttonStyles.btnSecondary}
        onClick={abrir}
        disabled={disabled}
        title="Explicación en lenguaje sencillo de este análisis"
      >
        <Stars size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} />
        {etiqueta}
      </button>

      <Modal
        show={abierto}
        onHide={() => setAbierto(false)}
        centered
        size="xl"
        scrollable
        contentClassName={modalStyles.modalContent}
      >
        <Modal.Header closeButton className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>
            Resumen con IA{resultado ? ` · ${resultado.titulo}` : ''}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cargando && (
            <div className={styles.mensaje} role="status">
              El asistente está leyendo el análisis. Puede tardar hasta 30 segundos.
            </div>
          )}
          {error && !cargando && (
            <div className={styles.mensaje} role="alert">
              {error}
            </div>
          )}
          {resultado && !cargando && (
            <ResumenIAVista
              interpretacion={resultado.interpretacion}
              meta={resultado}
              datosClave={resultado.datosClave}
            />
          )}
        </Modal.Body>
        <Modal.Footer className={modalStyles.modalFooter}>
          {resultado && !cargando && (
            <button type="button" className={buttonStyles.btnSecondary} onClick={() => void pedir(true)}>
              Volver a generar (consume cuota)
            </button>
          )}
          <button type="button" className={buttonStyles.btnPrimary} onClick={() => setAbierto(false)}>
            Cerrar
          </button>
        </Modal.Footer>
      </Modal>
    </>
  )
}

export default BotonResumenIA
