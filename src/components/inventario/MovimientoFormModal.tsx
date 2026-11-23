'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from 'react-bootstrap'
import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import type { MovimientoInput, ProductoInventario } from '@/services/inventarioService'

interface FormValues {
  productoId: number
  tipoMovimiento: 'ENTRADA' | 'SALIDA'
  cantidad: number
  fecha: string
  observacion: string
}

interface Props {
  show: boolean
  onClose: () => void
  onSave: (data: MovimientoInput) => void
  productos: ProductoInventario[]
  empresaId: number
}

export const MovimientoFormModal = ({ show, onClose, onSave, productos, empresaId }: Props) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>()

  useEffect(() => {
    if (!show) return
    reset({
      productoId: productos[0]?.idProducto ?? 0,
      tipoMovimiento: 'ENTRADA',
      cantidad: 0,
      fecha: new Date().toISOString().slice(0, 10),
      observacion: '',
    })
  }, [show, productos, reset])

  const onSubmit = (values: FormValues) => {
    onSave({
      empresaId,
      productoId: Number(values.productoId),
      tipoMovimiento: values.tipoMovimiento,
      cantidad: Number(values.cantidad),
      fecha: values.fecha,
      observacion: values.observacion || null,
    })
  }

  return (
    <Modal show={show} onHide={onClose} centered contentClassName={modalStyles.modalContent}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>Nuevo Movimiento</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">Producto</label>
            <select
              className={`form-select ${errors.productoId ? 'is-invalid' : ''}`}
              {...register('productoId', { required: 'Seleccione un producto', valueAsNumber: true })}
            >
              <option value={0}>Seleccione...</option>
              {productos.map((producto) => (
                <option key={producto.idProducto} value={producto.idProducto}>
                  {producto.codigoSku} — {producto.nombre}
                </option>
              ))}
            </select>
            {errors.productoId && (
              <div className="invalid-feedback">{errors.productoId.message as string}</div>
            )}
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Tipo</label>
              <select className="form-select" {...register('tipoMovimiento')}>
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
              </select>
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className={`form-control ${errors.fecha ? 'is-invalid' : ''}`}
                {...register('fecha', { required: 'La fecha es obligatoria' })}
              />
              {errors.fecha && <div className="invalid-feedback">{errors.fecha.message as string}</div>}
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Cantidad</label>
            <input
              type="number"
              step="1"
              className={`form-control ${errors.cantidad ? 'is-invalid' : ''}`}
              {...register('cantidad', {
                required: 'La cantidad es obligatoria',
                valueAsNumber: true,
                min: { value: 1, message: 'Debe ser mayor a cero' },
                validate: (valor) => Number.isInteger(valor) || 'Debe ser un número entero de unidades',
              })}
            />
            {errors.cantidad && (
              <div className="invalid-feedback">{errors.cantidad.message as string}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">Observación</label>
            <input className="form-control" {...register('observacion')} />
          </div>
        </Modal.Body>
        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonStyles.btnPrimary}>
            Guardar Movimiento
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default MovimientoFormModal
