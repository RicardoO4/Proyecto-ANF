'use client'

// Barra para guardar y abrir documentos del Módulo E en la base de datos
// (presupuestos de E1-E2 y evaluaciones de capital de E3). El borrador del
// navegador y el Excel siguen funcionando aunque falte la migración 007.
import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import Swal from 'sweetalert2'
import { apiClient, getErrorMessage } from '@/services/api'
import { Notifier } from '@/utils/Notifier'

import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import viewStyles from '@/styles/shared/View.module.css'
import styles from '@/styles/presupuesto/Presupuestos.module.css'

export interface DocumentoResumen {
  id: number
  nombre: string
  anio?: number
  creadoEn: string
  actualizadoEn: string
}

interface DocumentoActual {
  id: number
  nombre: string
  /** JSON de los datos tal como quedaron al guardar o abrir. */
  guardado: string
}

interface Props {
  recurso: 'presupuestos' | 'evaluaciones-capital'
  /** Palabra para los mensajes: "presupuesto", "evaluación"... */
  tipo: string
  empresaId: number | null
  datos: unknown
  /** Se llama al abrir un documento: la pantalla reemplaza sus datos. */
  onAbrir: (datos: unknown) => void
  /** Clave de localStorage para recordar qué documento está abierto. */
  claveLocal: string
  nombreSugerido?: string
}

const clasesSwal = {
  popup: 'swal-popup-custom',
  title: 'swal-title-custom',
  htmlContainer: 'swal-html-container-custom',
  confirmButton: 'swal-button-confirm-custom',
  cancelButton: 'swal-button-cancel-custom',
}

const formatoFecha = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' })

function leerActual(clave: string): DocumentoActual | null {
  try {
    const texto = typeof window !== 'undefined' ? window.localStorage.getItem(clave) : null
    return texto ? (JSON.parse(texto) as DocumentoActual) : null
  } catch {
    return null
  }
}

function guardarActual(clave: string, doc: DocumentoActual | null) {
  try {
    if (doc) window.localStorage.setItem(clave, JSON.stringify(doc))
    else window.localStorage.removeItem(clave)
  } catch {
    // Sin almacenamiento: solo se pierde el recordatorio del documento abierto.
  }
}

async function pedirNombre(titulo: string, inicial: string): Promise<string | null> {
  const r = await Swal.fire({
    title: titulo,
    input: 'text',
    inputValue: inicial,
    inputAttributes: { maxlength: '100' },
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    customClass: clasesSwal,
    inputValidator: (v) => (!v?.trim() ? 'Escriba un nombre.' : undefined),
  })
  return r.isConfirmed ? String(r.value).trim() : null
}

const DocumentosGuardados = ({ recurso, tipo, empresaId, datos, onAbrir, claveLocal, nombreSugerido = '' }: Props) => {
  const [actual, setActual] = useState<DocumentoActual | null>(() => leerActual(claveLocal))
  const [ocupado, setOcupado] = useState(false)
  const [lista, setLista] = useState<DocumentoResumen[] | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [errorLista, setErrorLista] = useState('')

  const jsonActual = JSON.stringify(datos)
  const sinGuardar = !actual || actual.guardado !== jsonActual

  const fijarActual = (doc: DocumentoActual | null) => {
    setActual(doc)
    guardarActual(claveLocal, doc)
  }

  const guardarComo = async () => {
    if (!empresaId) return
    const nombre = await pedirNombre(`Guardar ${tipo} como`, actual ? `${actual.nombre} (copia)` : nombreSugerido)
    if (!nombre) return
    setOcupado(true)
    try {
      const resp = await apiClient.post<DocumentoResumen>(`/${recurso}`, { empresaId, nombre, datos })
      fijarActual({ id: resp.data.id, nombre: resp.data.nombre, guardado: jsonActual })
      Notifier.success(`"${resp.data.nombre}" guardado en la base de datos.`)
    } catch (err) {
      Notifier.showError('No se pudo guardar', getErrorMessage(err, 'Intente de nuevo.'))
    } finally {
      setOcupado(false)
    }
  }

  const guardar = async () => {
    if (!actual) return guardarComo()
    setOcupado(true)
    try {
      await apiClient.put(`/${recurso}/${actual.id}`, { datos })
      fijarActual({ ...actual, guardado: jsonActual })
      Notifier.success(`Cambios guardados en "${actual.nombre}".`)
    } catch (err) {
      const mensaje = getErrorMessage(err, 'Intente de nuevo.')
      // Si el documento ya no existe, se ofrece guardarlo como uno nuevo.
      if (/no existe|borrado/i.test(mensaje)) {
        fijarActual(null)
        Notifier.warning('Ese documento ya no existe en la base. Guárdelo con un nombre nuevo.')
      } else {
        Notifier.showError('No se pudo guardar', mensaje)
      }
    } finally {
      setOcupado(false)
    }
  }

  const cargarLista = async () => {
    if (!empresaId) return
    setErrorLista('')
    setLista(null)
    try {
      const resp = await apiClient.get<DocumentoResumen[]>(`/${recurso}`, { params: { empresaId } })
      setLista(resp.data)
    } catch (err) {
      setErrorLista(getErrorMessage(err, 'No se pudo cargar la lista.'))
    }
  }

  const mostrarLista = () => {
    setAbierto(true)
    void cargarLista()
  }

  const abrir = async (doc: DocumentoResumen) => {
    if (sinGuardar && actual) {
      const ok = await Notifier.confirm({
        title: '¿Abrir sin guardar?',
        text: `Hay cambios sin guardar en "${actual.nombre}" que se perderán.`,
      })
      if (!ok.isConfirmed) return
    }
    setOcupado(true)
    try {
      const resp = await apiClient.get<DocumentoResumen & { datos: unknown }>(`/${recurso}/${doc.id}`)
      onAbrir(resp.data.datos)
      fijarActual({ id: resp.data.id, nombre: resp.data.nombre, guardado: JSON.stringify(resp.data.datos) })
      setAbierto(false)
      Notifier.success(`"${resp.data.nombre}" abierto.`)
    } catch (err) {
      Notifier.showError('No se pudo abrir', getErrorMessage(err, 'Intente de nuevo.'))
    } finally {
      setOcupado(false)
    }
  }

  const borrar = async (doc: DocumentoResumen) => {
    const ok = await Notifier.confirm({
      title: `¿Borrar "${doc.nombre}"?`,
      text: 'Se elimina de la base de datos para todos los usuarios y no se puede recuperar.',
      confirmButtonText: 'Sí, borrar',
    })
    if (!ok.isConfirmed) return
    try {
      await apiClient.delete(`/${recurso}/${doc.id}`)
      if (actual?.id === doc.id) fijarActual(null)
      Notifier.success(`"${doc.nombre}" borrado.`)
      void cargarLista()
    } catch (err) {
      Notifier.showError('No se pudo borrar', getErrorMessage(err, 'Intente de nuevo.'))
    }
  }

  return (
    <div className={styles.seccion} style={{ padding: '12px 16px' }}>
      <div className={styles.barra} style={{ marginBottom: 0 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, flex: 1, minWidth: 220 }}>
          {actual ? (
            <>
              Documento: <strong style={{ color: 'var(--fey-white)' }}>{actual.nombre}</strong>
              {sinGuardar && <span className={styles.sumaMal}> · cambios sin guardar</span>}
            </>
          ) : (
            <>No guardado en la base de datos (solo borrador en este navegador)</>
          )}
        </span>
        <button type="button" className={buttonStyles.btnPrimary} onClick={() => void guardar()} disabled={!empresaId || ocupado || (!!actual && !sinGuardar)}>
          Guardar
        </button>
        <button type="button" className={buttonStyles.btnSecondary} onClick={() => void guardarComo()} disabled={!empresaId || ocupado}>
          Guardar como
        </button>
        <button type="button" className={buttonStyles.btnSecondary} onClick={mostrarLista} disabled={!empresaId || ocupado}>
          Abrir
        </button>
      </div>

      <Modal show={abierto} onHide={() => setAbierto(false)} centered size="lg" contentClassName={modalStyles.modalContent}>
        <Modal.Header closeButton className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>Abrir {tipo}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorLista && <div className={styles.errores}>{errorLista}</div>}
          {!errorLista && lista === null && <p className={styles.ayuda}>Cargando...</p>}
          {lista && lista.length === 0 && <p className={styles.ayuda}>Todavía no hay documentos guardados.</p>}
          {lista && lista.length > 0 && (
            <table className={viewStyles.table}>
              <thead>
                <tr>
                  <th>Nombre</th>
                  {lista.some((d) => d.anio) && <th>Año</th>}
                  <th>Última modificación</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => (
                  <tr key={d.id}>
                    <td>{d.nombre}</td>
                    {lista.some((x) => x.anio) && <td>{d.anio ?? ''}</td>}
                    <td>{formatoFecha.format(new Date(d.actualizadoEn))}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className={buttonStyles.btnSecondary} style={{ padding: '4px 12px' }} onClick={() => void abrir(d)}>
                        Abrir
                      </button>{' '}
                      <button
                        type="button"
                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconDelete}`}
                        onClick={() => void borrar(d)}
                        title="Borrar"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal.Body>
      </Modal>
    </div>
  )
}

export default DocumentosGuardados
