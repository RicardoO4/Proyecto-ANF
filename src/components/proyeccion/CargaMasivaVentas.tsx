'use client'

import React, { useState } from 'react'
import { ventaHistoricaService } from '@/services/ventaHistoricaService'
import { Notifier } from '@/utils/Notifier'
import { Download, FileEarmarkArrowUp } from 'react-bootstrap-icons'
import buttonStyles from '@/styles/shared/Button.module.css'
import localStyles from '@/styles/estadosfinancieros/CargarEstadoFinanciero.module.css' // Reutilizamos estilos!

interface CargaMasivaVentasProps {
  ventas: string[]
  // eslint-disable-next-line no-unused-vars
  setVentas: (v: string[]) => void
}

export const CargaMasivaVentas = (_props: CargaMasivaVentasProps) => {
  // Lógica casi idéntica a la carga de estados financieros
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setSelectedFile(e.target.files ? e.target.files[0] : null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFile) {
      Notifier.warning('Selecciona un archivo.')
      return
    }

    setIsLoading(true)
    const toastId = Notifier.loading('Procesando archivo...')
    try {
      await ventaHistoricaService.uploadVentasExcel(selectedFile)
      Notifier.dismiss(String(toastId))
      Notifier.success('Ventas cargadas exitosamente desde Excel.')
      setSelectedFile(null)
      ;(e.target as HTMLFormElement).reset()
    } catch (error: unknown) {
      Notifier.dismiss(String(toastId))
      const err = error as { response?: { data?: { message?: string } } }
      Notifier.error(err.response?.data?.message || 'Error al procesar el archivo.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={localStyles.formBox}>
      <div className={localStyles.instructions}>
        <p>Sube las ventas históricas usando la plantilla de Excel.</p>
        <a href="/templates/plantilla_ventas.xlsx" className={buttonStyles.btnSecondary} download>
          <Download className="me-2" /> Descargar Plantilla
        </a>
      </div>
      <form onSubmit={handleSubmit}>
        <div className={localStyles.fileInputContainer}>
          <label htmlFor="file-upload-ventas" className={localStyles.fileInputLabel}>
            <FileEarmarkArrowUp className="me-2" /> Seleccionar archivo
          </label>
          <input
            id="file-upload-ventas"
            type="file"
            accept=".xlsx"
            className={localStyles.hiddenFileInput}
            onChange={handleFileChange}
            disabled={isLoading}
          />
          <span className={localStyles.fileName}>
            {selectedFile ? selectedFile.name : 'Ningún archivo seleccionado'}
          </span>
        </div>
        <div className={localStyles.submitContainer}>
          <button type="submit" className={buttonStyles.btnPrimary} disabled={!selectedFile || isLoading}>
            {isLoading ? 'Cargando...' : 'Cargar desde Excel'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CargaMasivaVentas
