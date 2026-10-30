'use client'

import React, { useEffect, useState } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import { proyeccionesSubMenuLinks } from '@/config/menuConfig'
import { empresaService } from '@/services/empresaService'
import viewStyles from '@/styles/shared/View.module.css'
import tabStyles from '@/styles/proyeccion/Proyecciones.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import { CargaMasivaVentas } from '@/components/proyeccion/CargaMasivaVentas'
import { CargaManualVentas } from '@/components/proyeccion/CargaManualVentas'
import { ventaHistoricaService } from '@/services/ventaHistoricaService'
import { Notifier } from '@/utils/Notifier'
import type { ProyeccionDTO } from '@/types'
import type { EmpresaResponseDTO } from '@/types'

export const Proyecciones = () => {
  const [empresas, setEmpresas] = useState<EmpresaResponseDTO[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState('')
  const [metodo, setMetodo] = useState('')
  const [ventas, setVentas] = useState<string[]>(Array(12).fill('')) // 12 meses vacíos
  const [activeTab, setActiveTab] = useState<'masiva' | 'manual'>('masiva')

  // Cargar empresas desde backend
  useEffect(() => {
    const cargarEmpresas = async () => {
      try {
        const data = await empresaService.getEmpresas()
        setEmpresas(data)
      } catch (error) {
        console.error('Error al cargar empresas:', error)
      }
    }
    cargarEmpresas()
  }, [])

  const [proyecciones, setProyecciones] = useState<ProyeccionDTO[]>([])

  const handleGenerarProyeccion = async () => {
    if (!empresaSeleccionada || !metodo) {
      Notifier.warning('Por favor seleccione una empresa y un método de proyección.')
      return
    }

    const toastId = Notifier.loading('Generando proyección...')
    try {
      // keep numeric month values in sync for the manual tab
      setVentas(Array(12).fill(''))
      const response = await ventaHistoricaService.getProyeccionVentas(
        parseInt(empresaSeleccionada, 10),
        12,
        metodo.toUpperCase().replace('-', '_'),
      )
      setProyecciones(response)
      Notifier.dismiss(String(toastId))
      Notifier.success('Proyección generada correctamente.')
    } catch (error: unknown) {
      Notifier.dismiss(String(toastId))
      const err = error as { response?: { data?: { message?: string } } }
      Notifier.error(err.response?.data?.message || 'Error al generar la proyección.')
    }
  }

  return (
    <div className={viewStyles.viewContainer}>
      <SubMenu links={proyeccionesSubMenuLinks} />

      <h1 className={viewStyles.viewTitle}>Proyección de Ventas</h1>
      <p className="mb-4">
        Este módulo permite realizar una proyección de ventas a 12 meses basada en datos históricos.
      </p>

      {/* --- Selector de Empresa --- */}
      <div className="mb-3">
        <label className="form-label">Seleccione la Empresa</label>
        <select
          className="form-select"
          value={empresaSeleccionada}
          onChange={(e) => setEmpresaSeleccionada(e.target.value)}
        >
          <option value="">Seleccione una empresa...</option>
          {empresas.map((e) => (
            <option key={e.empresaId} value={e.empresaId}>
              {e.nombreEmpresa}
            </option>
          ))}
        </select>
      </div>

      {/* --- Selector de Método --- */}
      <div className="mb-3">
        <label className="form-label">Seleccione el Método de Proyección</label>
        <select
          className="form-select"
          value={metodo}
          onChange={(e) => setMetodo(e.target.value)}
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
          <CargaMasivaVentas ventas={ventas} setVentas={setVentas} />
        )}
        {activeTab === 'manual' && (
          <CargaManualVentas ventas={ventas} setVentas={setVentas} />
        )}
      </div>

      {/* --- Botón Generar Proyección --- */}
      <div className="mt-4">
        <button
          className={buttonStyles.btnPrimary}
          onClick={handleGenerarProyeccion}
        >
          Generar Proyección
        </button>
        {proyecciones.length > 0 && (
          <div className="mt-4 table-responsive">
            <h5>Resultados de la Proyección</h5>
            <table className={viewStyles.table}>
              <thead>
                <tr>
                  <th>Fecha proyectada</th>
                  <th>Monto proyectado</th>
                </tr>
              </thead>
              <tbody>
                {proyecciones.map((p, i) => (
                  <tr key={i}>
                    <td>{p.fechaProyectada || (p as unknown as { fecha?: string }).fecha}</td>
                    <td>
                      {(p.montoProyectado ?? (p as unknown as { monto?: number }).monto)?.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Proyecciones
