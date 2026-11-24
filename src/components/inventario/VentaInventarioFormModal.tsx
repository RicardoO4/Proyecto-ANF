'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from 'react-bootstrap'
import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import { inventarioService, type ProductoInventario, type VentaInventarioInput } from '@/services/inventarioService'

interface FormValues {
  productoId: number
  anio: number
  cantidad: number
  precioVentaUnitario: number
}

interface Props {
  show: boolean
  onClose: () => void
  onSave: (data: VentaInventarioInput) => void
  productos: ProductoInventario[]
  empresaId: number
}

export const VentaInventarioFormModal = ({ show, onClose, onSave, productos, empresaId }: Props) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>()
  const [cargandoPrecio, setCargandoPrecio] = useState(false)

  useEffect(() => {
    if (!show) return
    reset({
      productoId: productos[0]?.idProducto ?? 0,
      anio: new Date().getFullYear(),
      cantidad: 0,
      precioVentaUnitario: 0,
    })
  }, [show, productos, reset])

  const productoId = Number(watch('productoId'))
  const cantidad = Number(watch('cantidad'))
  const precioVentaUnitario = Number(watch('precioVentaUnitario'))
  const subtotal =
    Number.isFinite(cantidad) && Number.isFinite(precioVentaUnitario) && cantidad > 0 && precioVentaUnitario > 0
      ? (cantidad * precioVentaUnitario).toFixed(2)
      : '0.00'

  useEffect(() => {
    if (!show || !Number.isInteger(productoId) || productoId <= 0 || empresaId <= 0) return
    let activo = true
    setCargandoPrecio(true)
    void inventarioService.getPrecioVentaSugerido(empresaId, productoId)
      .then((precio) => {
        if (!activo) return
        if (precio != null) setValue('precioVentaUnitario', Number(precio), { shouldValidate: true, shouldDirty: false })
      })
      .catch(() => undefined)
      .finally(() => {
        if (activo) setCargandoPrecio(false)
      })
    return () => {
      activo = false
    }
  }, [show, productoId, empresaId, setValue])

  const onSubmit = (values: FormValues) => {
    onSave({
      empresaId,
      productoId: Number(values.productoId),
      anio: Number(values.anio),
      cantidad: Number(values.cantidad),
      precioVentaUnitario: Number(values.precioVentaUnitario),
    })
  }

  return (
    <Modal show={show} onHide={onClose} centered contentClassName={modalStyles.modalContent}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>Nueva Venta SKU</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Precio de venta sugerido desde la última venta SKU registrada; puedes ajustarlo. Subtotal calculado automáticamente.
          </p>
          <div className="mb-3">
            <label className="form-label">Producto</label>
            <select
              className={`form-select ${errors.productoId ? 'is-invalid' : ''}`}
              {...register('productoId', { required: 'Seleccione un producto', valueAsNumber: true, min: { value: 1, message: 'Seleccione un producto' } })}
            >
              <option value={0}>Seleccione...</option>
              {productos.map((producto) => (
                <option key={producto.idProducto} value={producto.idProducto}>
                  {producto.codigoSku} — {producto.nombre}
                </option>
              ))}
            </select>
            {errors.productoId && <div className="invalid-feedback">{errors.productoId.message as string}</div>}
          </div>
          <div className="row">
            <div className="col-md-4 mb-3">
              <label className="form-label">Año</label>
              <input
                type="number"
                min={2023}
                className={`form-control ${errors.anio ? 'is-invalid' : ''}`}
                {...register('anio', { required: 'El año es obligatorio', valueAsNumber: true, min: { value: 2023, message: 'El año mínimo es 2023' }, max: { value: 2100, message: 'Año inválido' } })}
              />
              {errors.anio && <div className="invalid-feedback">{errors.anio.message as string}</div>}
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Cantidad</label>
              <input
                type="number"
                step="0.0001"
                className={`form-control ${errors.cantidad ? 'is-invalid' : ''}`}
                {...register('cantidad', { required: 'La cantidad es obligatoria', valueAsNumber: true, min: { value: 0.0001, message: 'Debe ser mayor a cero' } })}
              />
              {errors.cantidad && <div className="invalid-feedback">{errors.cantidad.message as string}</div>}
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Precio de venta ($/unidad)</label>
              <input
                type="number"
                step="0.0001"
                className={`form-control ${errors.precioVentaUnitario ? 'is-invalid' : ''}`}
                {...register('precioVentaUnitario', { required: 'El precio de venta es obligatorio', valueAsNumber: true, min: { value: 0.0001, message: 'Debe ser mayor a cero' } })}
              />
              {errors.precioVentaUnitario && <div className="invalid-feedback">{errors.precioVentaUnitario.message as string}</div>}
              {cargandoPrecio && <div className="form-text">Cargando precio sugerido...</div>}
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">Subtotal ($)</label>
              <input type="text" className="form-control" value={subtotal} readOnly />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonStyles.btnPrimary}>
            Guardar Venta SKU
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default VentaInventarioFormModal
