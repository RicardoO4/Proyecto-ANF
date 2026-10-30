'use client'

import React, { useState, useEffect } from 'react'
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa'
import SubMenu from '@/components/shared/SubMenu'
import { empresasSubMenuLinks } from '@/config/menuConfig'
import { empresaService } from '@/services/empresaService'
import { Notifier } from '@/utils/Notifier'
import { EmpresaFormModal } from '@/components/empresa/EmpresaFormModal'
import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import type { EmpresaResponseDTO } from '@/types'

export const Empresas = () => {
  const [empresas, setEmpresas] = useState<EmpresaResponseDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEmpresa, setEditingEmpresa] = useState<EmpresaResponseDTO | null>(null)

  const fetchEmpresas = async () => {
    try {
      setLoading(true)
      setEmpresas(await empresaService.getEmpresas())
    } catch (error) {
      Notifier.error('No se pudieron cargar las empresas.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmpresas()
  }, [])

  const handleOpenCreateModal = () => {
    setEditingEmpresa(null)
    setIsModalOpen(true)
  }
  const handleOpenEditModal = (empresa: EmpresaResponseDTO) => {
    setEditingEmpresa(empresa)
    setIsModalOpen(true)
  }
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingEmpresa(null)
  }

  const handleSave = async (data: any, id?: number) => {
    const isEditing = !!id
    const toastId = Notifier.loading(isEditing ? 'Actualizando...' : 'Guardando...')
    try {
      if (isEditing) {
        await empresaService.updateEmpresa(id, data)
      } else {
        await empresaService.createEmpresa(data)
      }
      Notifier.dismiss(toastId)
      Notifier.success(`¡Empresa ${isEditing ? 'actualizada' : 'creada'}!`)
      handleCloseModal()
      fetchEmpresas()
    } catch (err: any) {
      Notifier.dismiss(toastId)
      Notifier.error(err?.response?.data?.message || `Error al ${isEditing ? 'actualizar' : 'crear'}.`)
    }
  }

  const handleDelete = async (empresa: EmpresaResponseDTO) => {
    const result = await Notifier.confirm({
      title: `¿Eliminar "${empresa.nombreEmpresa}"?`,
      text: 'Esta acción no se puede deshacer.',
    })
    if (result.isConfirmed) {
      const toastId = Notifier.loading('Eliminando...')
      try {
        await empresaService.deleteEmpresa(empresa.empresaId)
        Notifier.dismiss(toastId)
        Notifier.success('Empresa eliminada.')
        fetchEmpresas()
      } catch (error) {
        Notifier.dismiss(toastId)
        Notifier.error('No se pudo eliminar la empresa.')
      }
    }
  }

  return (
    <>
      <SubMenu links={empresasSubMenuLinks} />
      <div className={viewStyles.viewContainer}>
        <div className={viewStyles.viewHeader}>
          <h2 className={viewStyles.viewTitle}>Listado de Empresas</h2>
          <button className={buttonStyles.btnPrimary} onClick={handleOpenCreateModal}>
            <FaPlus className="me-2" />
            Nueva Empresa
          </button>
        </div>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="table-responsive">
            <table className={viewStyles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>NIT</th>
                  <th>Sector</th>
                  <th>Usuario ID</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empresas.map((e) => (
                  <tr key={e.empresaId}>
                    <td>{e.empresaId}</td>
                    <td>{e.nombreEmpresa}</td>
                    <td>{e.empresaNit || 'N/A'}</td>
                    <td>{e.nombreSector}</td>
                    <td>{e.usuarioId}</td>
                    <td className="text-end">
                      <button
                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconEdit} me-2`}
                        onClick={() => handleOpenEditModal(e)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconDelete}`}
                        onClick={() => handleDelete(e)}
                      >
                        <FaTrash />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <EmpresaFormModal show={isModalOpen} onClose={handleCloseModal} onSave={handleSave} initialData={editingEmpresa} />
    </>
  )
}

export default Empresas
