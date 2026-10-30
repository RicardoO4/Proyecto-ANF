'use client'

import React, { useState, useEffect } from 'react'
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa'
import SubMenu from '@/components/shared/SubMenu'
import { sectoresSubMenuLinks } from '@/config/menuConfig'
import { sectorService } from '@/services/sectorService'
import { Notifier } from '@/utils/Notifier'
import { SectorFormModal } from '@/components/empresa/SectorFormModal'
import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import type { SectorResponse } from '@/services/sectorService'

export const Sectores = () => {
  const [sectores, setSectores] = useState<SectorResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSector, setEditingSector] = useState<SectorResponse | null>(null)

  const fetchSectores = async () => {
    try {
      setLoading(true)
      const data = await sectorService.getSectores()
      setSectores(data)
    } catch (error) {
      Notifier.error('No se pudieron cargar los sectores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSectores()
  }, [])

  const handleOpenCreateModal = () => {
    setEditingSector(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (sector: SectorResponse) => {
    setEditingSector(sector)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingSector(null)
  }

  const handleSave = async (data: any, id?: number) => {
    const isEditing = !!id
    const loadingToastId = Notifier.loading(isEditing ? 'Actualizando...' : 'Guardando...')

    try {
      if (isEditing) {
        await sectorService.updateSector(id, data)
      } else {
        await sectorService.createSector(data)
      }
      Notifier.dismiss(loadingToastId)
      Notifier.success(`¡Sector ${isEditing ? 'actualizado' : 'creado'} exitosamente!`)
      handleCloseModal()
      fetchSectores()
    } catch (err: any) {
      if (err?.response && err.response.status === 409) {
        Notifier.error('Ya existe un sector con ese nombre.')
      } else {
        Notifier.error(err?.response?.data?.message || `Error al ${isEditing ? 'actualizar' : 'crear'}.`)
      }
    }
  }

  const handleDelete = async (sector: SectorResponse) => {
    const result = await Notifier.confirm({
      title: `¿Eliminar "${sector.nombreSector}"?`,
      text: 'Esta acción no se puede deshacer.',
      confirmButtonText: 'Sí, eliminar',
    })

    if (result.isConfirmed) {
      const loadingToastId = Notifier.loading('Eliminando sector...')
      try {
        await sectorService.deleteSector(sector.idSector)
        Notifier.dismiss(loadingToastId)
        Notifier.success('Sector eliminado.')
        fetchSectores()
      } catch (error) {
        Notifier.dismiss(loadingToastId)
        Notifier.error('No se pudo eliminar el sector.')
      }
    }
  }

  return (
    <>
      <SubMenu links={sectoresSubMenuLinks} />

      <div className={viewStyles.viewContainer}>
        <div className={viewStyles.viewHeader}>
          <h2 className={viewStyles.viewTitle}>Listado de Sectores</h2>
          <button className={buttonStyles.btnPrimary} onClick={handleOpenCreateModal}>
            <FaPlus className="me-2" />
            Nuevo Sector
          </button>
        </div>

        {loading ? (
          <p>Cargando datos...</p>
        ) : (
          <div className="table-responsive">
            <table className={viewStyles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre del Sector</th>
                  <th>Descripción</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sectores.map((sector) => (
                  <tr key={sector.idSector}>
                    <td>{sector.idSector}</td>
                    <td>{sector.nombreSector}</td>
                    <td>{sector.descripcion || 'N/A'}</td>
                    <td className="text-end">
                      <button
                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconEdit} me-2`}
                        onClick={() => handleOpenEditModal(sector)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconDelete}`}
                        onClick={() => handleDelete(sector)}
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

      <SectorFormModal show={isModalOpen} onClose={handleCloseModal} onSave={handleSave} initialData={editingSector} />
    </>
  )
}

export default Sectores
