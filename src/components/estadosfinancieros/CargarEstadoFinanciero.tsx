'use client'

import React, { useState } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import { estadosFinancierosSubMenuLinks } from '@/config/menuConfig'
import { estadoFinancieroService } from '@/services/estadoFinancieroService'
import type { ResultadoCarga } from '@/services/estadoFinancieroService'
import { Notifier } from '@/utils/Notifier'
import { Download, FileEarmarkArrowUp, InfoCircleFill } from 'react-bootstrap-icons'

import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import localStyles from '@/styles/estadosfinancieros/CargarEstadoFinanciero.module.css'

type ApiError = { response?: { status?: number; data?: { message?: string; detalles?: string[] } } }

const money = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString('es-SV', { style: 'currency', currency: 'USD' })

const CargarEstadoFinanciero = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)
  const [errores, setErrores] = useState<{ message: string; detalles: string[] } | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0])
      setResultado(null)
      setErrores(null)
    }
  }

  const subir = async (file: File, reemplazar: boolean): Promise<void> => {
    const toastId = Notifier.loading('Cargando y procesando archivo...')
    try {
      const data = await estadoFinancieroService.uploadEstadoFinanciero(file, reemplazar)
      Notifier.dismiss(String(toastId))
      Notifier.success(data.reemplazado ? '¡Año reemplazado exitosamente!' : '¡Archivo cargado exitosamente!')
      setResultado(data)
      setSelectedFile(null)
      const input = document.getElementById('file-upload') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (error: unknown) {
      Notifier.dismiss(String(toastId))
      const err = error as ApiError
      const message = err.response?.data?.message || 'Error al procesar el archivo.'
      if (err.response?.status === 409 && !reemplazar) {
        const confirm = await Notifier.confirm({
          title: 'Este año ya está cargado',
          text: `${message} Los datos anteriores se eliminarán.`,
          confirmButtonText: 'Sí, reemplazar',
        })
        if (confirm.isConfirmed) await subir(file, true)
        return
      }
      setErrores({ message, detalles: err.response?.data?.detalles ?? [] })
      Notifier.error(`Error: ${message}`)
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedFile) {
      Notifier.warning('Por favor, selecciona un archivo antes de cargar.')
      return
    }
    setIsLoading(true)
    setResultado(null)
    setErrores(null)
    try {
      await subir(selectedFile, false)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <SubMenu links={estadosFinancierosSubMenuLinks} />
      <div className={viewStyles.viewContainer}>
        <h1 className={viewStyles.viewTitle}>Cargar Estados Financieros</h1>

        <div className={localStyles.formBox}>
          <div className={localStyles.instructions}>
            <InfoCircleFill size={24} className="mb-3" style={{ color: 'var(--fey-graphite)' }} />
            <p>
              Sube la <strong>balanza de comprobación</strong> del año (.xlsx) con las hojas{' '}
              <strong>metadata</strong> (empresa, año y tipo BALANCE_COMPROBACION) y <strong>lineas</strong>{' '}
              (código y saldo; los saldos acreedores en negativo o entre paréntesis).
              <br />
              También se acepta un Excel con las hojas <strong>metadata</strong>, <strong>balance</strong> y{' '}
              <strong>resultados</strong>. Se guardan el Balance General, el Estado de Resultados y las ventas
              del año en una sola operación.
            </p>
            <a href="/templates/plantilla_estado_financiero.xlsx" className={buttonStyles.btnSecondary} download>
              <Download className="me-2" />
              Descargar Plantilla
            </a>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={localStyles.fileInputContainer}>
              <label htmlFor="file-upload" className={localStyles.fileInputLabel}>
                <FileEarmarkArrowUp className="me-2" />
                Seleccionar archivo
              </label>

              {/* Este es el input real, pero estará oculto */}
              <input
                type="file"
                id="file-upload"
                className={localStyles.hiddenFileInput}
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                disabled={isLoading}
              />

              <span className={localStyles.fileName}>
                {selectedFile ? selectedFile.name : 'Ningún archivo seleccionado'}
              </span>
            </div>

            <div className={localStyles.submitContainer}>
              <button
                type="submit"
                className={buttonStyles.btnPrimary}
                disabled={!selectedFile || isLoading}
              >
                {isLoading ? 'Procesando...' : 'Cargar Reporte'}
              </button>
            </div>
          </form>

          {errores && (
            <div className="mt-4">
              <p className="fw-bold text-danger mb-2">{errores.message}</p>
              {errores.detalles.length > 0 && (
                <ul className="small mb-0">
                  {errores.detalles.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {resultado && (
            <div className="mt-4">
              <p className="fw-bold mb-2">
                {resultado.formato !== 'INDIVIDUAL'
                  ? `${resultado.nombreEmpresa ?? 'Empresa'} — ${resultado.anio}${resultado.reemplazado ? ' (reemplazado)' : ''}`
                  : `${resultado.tipoReporte} ${resultado.anio}: ${resultado.lineas} líneas cargadas`}
              </p>
              {resultado.formato !== 'INDIVIDUAL' && (
                <table className={viewStyles.table}>
                  <tbody>
                    <tr><td>Total Activo</td><td>{money(resultado.totalActivo)}</td></tr>
                    <tr><td>Total Pasivo</td><td>{money(resultado.totalPasivo)}</td></tr>
                    <tr><td>Total Patrimonio</td><td>{money(resultado.totalPatrimonio)}</td></tr>
                    <tr><td>Ingresos</td><td>{money(resultado.totalIngresos)}</td></tr>
                    <tr><td>Costos y gastos</td><td>{money(resultado.totalCostosGastos)}</td></tr>
                    <tr><td>Utilidad neta</td><td>{money(resultado.utilidadNeta)}</td></tr>
                    <tr>
                      <td>Venta registrada</td>
                      <td>{resultado.ventaRegistrada != null ? money(resultado.ventaRegistrada) : 'No registrada'}</td>
                    </tr>
                    <tr>
                      <td>Cuentas cargadas</td>
                      <td>{resultado.lineasBalance} balance / {resultado.lineasResultados} resultados</td>
                    </tr>
                  </tbody>
                </table>
              )}
              {resultado.avisos.length > 0 && (
                <>
                  <p className="fw-bold mt-3 mb-2">Avisos</p>
                  <ul className="small mb-0">
                    {resultado.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default CargarEstadoFinanciero
