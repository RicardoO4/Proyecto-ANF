'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from 'react-bootstrap'
import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import type { SectorResponse } from '@/services/sectorService'

interface SectorFormModalProps {
  show: boolean
  onClose: () => void
  // eslint-disable-next-line no-unused-vars
  onSave: (data: any, id?: number) => void
  initialData?: SectorResponse | null
}

export const SectorFormModal = ({ show, onClose, onSave, initialData = null }: SectorFormModalProps) => {
  const isCreateMode = !initialData
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm()

  useEffect(() => {
    if (show) {
      // Si hay datos iniciales, los carga; si no, resetea a los valores por defecto.
      reset(
        (initialData as any) || { nombreSector: '', descripcion: '', paisReferencia: '', fuenteDatos: '' },
      )
    }
  }, [show, initialData, reset])

  const onSubmit = (data: any) => {
    onSave(data, (initialData as any)?.idSector)
  }

  return (
    <Modal show={show} onHide={onClose} centered contentClassName={modalStyles.modalContent}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>
            {isCreateMode ? 'Registrar Nuevo Sector' : 'Editar Sector'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-3">
            <label htmlFor="nombreSector" className="form-label">
              Nombre del Sector
            </label>
            <input
              type="text"
              className={`form-control ${errors.nombreSector ? 'is-invalid' : ''}`}
              id="nombreSector"
              {...register('nombreSector', { required: 'El nombre es obligatorio' })}
            />
            {errors.nombreSector && <div className="invalid-feedback">{errors.nombreSector.message as string}</div>}
          </div>
          <div className="mb-3">
            <label htmlFor="descripcion" className="form-label">
              Descripción
            </label>
            <textarea
              className="form-control"
              id="descripcion"
              rows={3}
              {...register('descripcion')}
            ></textarea>
          </div>
          {/* --- NUEVOS CAMPOS AÑADIDOS --- */}
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="paisReferencia" className="form-label">
                País de Referencia
              </label>
              <input
                type="text"
                className="form-control"
                id="paisReferencia"
                {...register('paisReferencia')}
              />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="fuenteDatos" className="form-label">
                Fuente de Datos
              </label>
              <input
                type="text"
                className="form-control"
                id="fuenteDatos"
                {...register('fuenteDatos')}
              />
            </div>
          </div>
          {/* --- FIN DE NUEVOS CAMPOS --- */}
        </Modal.Body>

        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonStyles.btnPrimary}>
            {isCreateMode ? 'Guardar Sector' : 'Guardar Cambios'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default SectorFormModal
