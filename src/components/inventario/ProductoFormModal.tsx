'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from 'react-bootstrap'
import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import { siguienteCodigoSku } from '@/lib/inventarioSku'
import { inventarioService, type ProductoInput, type ProductoInventario } from '@/services/inventarioService'

interface FormValues {
  nombre: string
  descripcion: string
  costoUnitario: number
  stockActual: number
  activo: boolean
}

interface Props {
  show: boolean
  onClose: () => void
  onSave: (data: ProductoInput, id?: number) => void
  initialData: ProductoInventario | null
  empresaId: number
}

export const ProductoFormModal = ({ show, onClose, onSave, initialData, empresaId }: Props) => {
  const [skuPreview, setSkuPreview] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>()

  useEffect(() => {
    if (!show) return
    if (initialData) {
      Promise.resolve().then(() => setSkuPreview(initialData.codigoSku))
      reset({
        nombre: initialData.nombre,
        descripcion: initialData.descripcion ?? '',
        costoUnitario: initialData.costoUnitario,
        stockActual: initialData.stockActual,
        activo: initialData.activo,
      })
      return
    }
    Promise.resolve().then(() => setSkuPreview(''))
    reset({
      nombre: '',
      descripcion: '',
      costoUnitario: 0,
      stockActual: 0,
      activo: true,
    })
    let activo = true
    inventarioService
      .getProductos(empresaId)
      .then((productos) => {
        if (activo) setSkuPreview(siguienteCodigoSku(productos.map((producto) => producto.codigoSku)))
      })
      .catch(() => {
        if (activo) setSkuPreview('')
      })
    return () => {
      activo = false
    }
  }, [show, initialData, empresaId, reset])

  const onSubmit = (values: FormValues) => {
    onSave(
      {
        empresaId,
        ...(initialData ? { codigoSku: initialData.codigoSku } : {}),
        nombre: values.nombre.trim(),
        descripcion: values.descripcion || null,
        costoUnitario: Number(values.costoUnitario),
        stockActual: Number(values.stockActual),
        activo: values.activo,
      },
      initialData?.idProducto,
    )
  }

  return (
    <Modal show={show} onHide={onClose} centered contentClassName={modalStyles.modalContent}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>
            {initialData ? 'Editar Producto' : 'Nuevo Producto'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">SKU</label>
            <input
              className="form-control"
              value={skuPreview}
              disabled
              placeholder="Se asignará automáticamente"
            />
            <div className="form-text">
              El SKU se asigna automáticamente de forma consecutiva.
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Nombre</label>
            <input
              className={`form-control ${errors.nombre ? 'is-invalid' : ''}`}
              {...register('nombre', { required: 'El nombre es obligatorio' })}
            />
            {errors.nombre && <div className="invalid-feedback">{errors.nombre.message as string}</div>}
          </div>
          <div className="mb-3">
            <label className="form-label">Descripción</label>
            <input className="form-control" {...register('descripcion')} />
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Costo unitario ($)</label>
              <input
                type="number"
                step="0.0001"
                className={`form-control ${errors.costoUnitario ? 'is-invalid' : ''}`}
                {...register('costoUnitario', {
                  required: 'El costo es obligatorio',
                  valueAsNumber: true,
                  min: { value: 0, message: 'No puede ser negativo' },
                })}
              />
              {errors.costoUnitario && (
                <div className="invalid-feedback">{errors.costoUnitario.message as string}</div>
              )}
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Stock actual</label>
              <input
                type="number"
                step="1"
                className={`form-control ${errors.stockActual ? 'is-invalid' : ''}`}
                {...register('stockActual', {
                  required: 'El stock es obligatorio',
                  valueAsNumber: true,
                  min: { value: 0, message: 'No puede ser negativo' },
                  validate: (valor) => Number.isInteger(valor) || 'Debe ser un número entero de unidades',
                })}
              />
              {errors.stockActual && (
                <div className="invalid-feedback">{errors.stockActual.message as string}</div>
              )}
            </div>
          </div>
          <div className="form-check">
            <input className="form-check-input" type="checkbox" {...register('activo')} />
            <label className="form-check-label">Producto activo</label>
          </div>
        </Modal.Body>
        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonStyles.btnPrimary}>
            {initialData ? 'Guardar Cambios' : 'Guardar Producto'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default ProductoFormModal
