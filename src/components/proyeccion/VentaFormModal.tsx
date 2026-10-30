'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from 'react-bootstrap'
import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import type { VentaHistorica } from '@/services/ventaHistoricaService'

export interface VentaFormData {
  fechaVenta: string
  montoVenta: number
  observacion?: string | null
}

interface VentaFormModalProps {
  show: boolean
  onClose: () => void
  // eslint-disable-next-line no-unused-vars
  onSave: (ventaId: number | null, data: VentaFormData) => void
  initialData: VentaHistorica | null
  isCreateMode: boolean
}

// Ahora recibe 'isCreateMode' para saber si es para crear o editar
export const VentaFormModal = ({ show, onClose, onSave, initialData, isCreateMode }: VentaFormModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Record<string, string | number>>()

  useEffect(() => {
    if (show) {
      if (isCreateMode) {
        // Si es modo creación, resetea el formulario a valores vacíos
        reset({ fechaVenta: '', montoVenta: '', observacion: '' })
      } else if (initialData) {
        // Si es modo edición, carga los datos existentes
        const formattedData = {
          ...initialData,
          fechaVenta: initialData.fechaVenta.split('T')[0],
        }
        reset(formattedData as unknown as Record<string, string | number>)
      }
    }
  }, [show, initialData, isCreateMode, reset])

  const onSubmit = (data: Record<string, string | number>) => {
    // En modo edición, pasamos el ID; en modo creación, no es necesario
    onSave(
      isCreateMode ? null : initialData!.id,
      data as unknown as VentaFormData,
    )
  }

  return (
    <Modal show={show} onHide={onClose} centered contentClassName={modalStyles.modalContent}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header closeButton className={modalStyles.modalHeader}>
          {/* El título ahora es dinámico */}
          <Modal.Title>{isCreateMode ? 'Añadir Nueva Venta' : 'Editar Venta Histórica'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">Fecha de Venta</label>
            <input
              type="date"
              className={`form-control ${errors.fechaVenta ? 'is-invalid' : ''}`}
              {...register('fechaVenta', { required: 'La fecha es obligatoria' })}
            />
            {errors.fechaVenta && (
              <div className="invalid-feedback">{errors.fechaVenta.message as string}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">Monto de Venta</label>
            <input
              type="number"
              step="0.01"
              className={`form-control ${errors.montoVenta ? 'is-invalid' : ''}`}
              {...register('montoVenta', { required: 'El monto es obligatorio', valueAsNumber: true })}
            />
            {errors.montoVenta && (
              <div className="invalid-feedback">{errors.montoVenta.message as string}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">Observación</label>
            <input type="text" className="form-control" {...register('observacion')} />
          </div>
        </Modal.Body>
        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          {/* El texto del botón de guardado también es dinámico */}
          <button type="submit" className={buttonStyles.btnPrimary}>
            {isCreateMode ? 'Guardar Venta' : 'Guardar Cambios'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default VentaFormModal
