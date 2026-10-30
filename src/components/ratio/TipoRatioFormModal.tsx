'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from 'react-bootstrap'

import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'

interface TipoRatioFormModalProps {
  show: boolean
  onClose: () => void
  // eslint-disable-next-line no-unused-vars
  onSave: (data: Record<string, string>, id?: number) => void
  initialData: { id?: number; codigo?: string | null; nombre?: string; descripcion?: string | null; unidad?: string | null } | null
}

export const TipoRatioFormModal = ({ show, onClose, onSave, initialData = null }: TipoRatioFormModalProps) => {
  // Determina si estamos en modo 'Crear' o 'Editar'
  const isCreateMode = !initialData

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Record<string, string>>()

  // useEffect para resetear el formulario cuando se abre/cierra o cambian los datos
  useEffect(() => {
    if (show) {
      reset(
        (initialData as unknown as Record<string, string>) || {
          codigo: '',
          nombre: '',
          descripcion: '',
          unidad: '',
        },
      )
    }
  }, [show, initialData, reset])

  // La función que se ejecuta al enviar el formulario
  const onSubmit = (data: Record<string, string>) => {
    onSave(data, initialData?.id)
  }

  return (
    <Modal show={show} onHide={onClose} centered size="lg" contentClassName={modalStyles.modalContent}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>
            {isCreateMode ? 'Registrar Nuevo Tipo de Ratio' : 'Editar Tipo de Ratio'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* --- CAMPO CÓDIGO --- */}
          <div className="mb-3">
            <label className="form-label">Código</label>
            <input
              type="text"
              className={`form-control ${errors.codigo ? 'is-invalid' : ''}`}
              maxLength={5}
              {...register('codigo', {
                required: 'El código es obligatorio',
                maxLength: { value: 5, message: 'El código no puede tener más de 5 caracteres' },
              })}
            />
            {errors.codigo && <div className="invalid-feedback">{errors.codigo.message as string}</div>}
          </div>

          {/* --- CAMPO NOMBRE --- */}
          <div className="mb-3">
            <label className="form-label">Nombre del Tipo de Ratio</label>
            <input
              type="text"
              className={`form-control ${errors.nombre ? 'is-invalid' : ''}`}
              {...register('nombre', { required: 'El nombre es obligatorio' })}
            />
            {errors.nombre && <div className="invalid-feedback">{errors.nombre.message as string}</div>}
          </div>

          {/* --- CAMPO DESCRIPCIÓN --- */}
          <div className="mb-3">
            <label className="form-label">Descripción</label>
            <textarea
              className={`form-control ${errors.descripcion ? 'is-invalid' : ''}`}
              rows={3}
              {...register('descripcion')}
            ></textarea>
          </div>

          {/* --- CAMPO UNIDAD --- */}
          <div className="mb-3">
            <label className="form-label">Unidad de Medida</label>
            <input
              type="text"
              className={`form-control ${errors.unidad ? 'is-invalid' : ''}`}
              {...register('unidad', { required: 'La unidad es obligatoria' })}
            />
            {errors.unidad && <div className="invalid-feedback">{errors.unidad.message as string}</div>}
          </div>
        </Modal.Body>

        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonStyles.btnPrimary}>
            {isCreateMode ? 'Guardar Tipo' : 'Guardar Cambios'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default TipoRatioFormModal
