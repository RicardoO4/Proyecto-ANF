'use client'

import React, { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Modal } from 'react-bootstrap'

import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import type {
  RatioResponseDTO,
  CategoriaRatioResponseDTO,
  ParametroSectorResponseDTO,
  EmpresaResponseDTO,
} from '@/types'

interface RatioFormModalProps {
  show: boolean
  onClose: () => void
  // eslint-disable-next-line no-unused-vars
  onSave: (data: Record<string, string>, id?: number) => void
  initialData?: Record<string, unknown> | null
  categorias?: CategoriaRatioResponseDTO[]
  parametros?: ParametroSectorResponseDTO[]
  empresas?: EmpresaResponseDTO[]
}

export const RatioFormModal = ({
  show,
  onClose,
  onSave,
  initialData = null,
  categorias = [],
  parametros = [],
  empresas = [],
}: RatioFormModalProps) => {
  const isCreateMode = !initialData
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Record<string, string>>()

  useEffect(() => {
    if (show) {
      reset(
        (initialData as unknown as Record<string, string>) || {
          empresa_id: '',
          id_categoria_ratio: '',
          id_parametro_sector: '',
          anio_ratio: '',
          periodo_ratio: '',
        },
      )
    }
  }, [show, initialData, reset])

  const onSubmit = (data: Record<string, string>) => {
    onSave(data, (initialData as { id_ratio?: number } | null)?.id_ratio)
  }

  return (
    <Modal show={show} onHide={onClose} centered size="lg" contentClassName={modalStyles.modalContent}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>
            {isCreateMode ? 'Registrar Nuevo Ratio' : 'Editar Ratio'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* --- SELECTOR DE EMPRESA --- */}
          <div className="mb-3">
            <label className="form-label">Empresa</label>
            <select
              className={`form-select ${errors.empresa_id ? 'is-invalid' : ''}`}
              {...register('empresa_id', { required: 'Debe seleccionar una empresa' })}
            >
              <option value="">-- Seleccionar Empresa --</option>
              {empresas.map((emp) => (
                <option key={emp.empresaId} value={emp.empresaId}>
                  {emp.nombreEmpresa}
                </option>
              ))}
            </select>
            {errors.empresa_id && <div className="invalid-feedback">{errors.empresa_id.message as string}</div>}
          </div>

          {/* SELECTOR DE CATEGORÍA */}
          <div className="mb-3">
            <label className="form-label">Categoría</label>
            <select
              className={`form-select ${errors.id_categoria_ratio ? 'is-invalid' : ''}`}
              {...register('id_categoria_ratio', { required: 'Debe seleccionar una categoría' })}
            >
              <option value="">-- Seleccionar Categoría --</option>
              {categorias.map((cat) => (
                <option key={cat.idCategoriaRatio} value={cat.idCategoriaRatio}>
                  {cat.nombreTipo}
                </option>
              ))}
            </select>
            {errors.id_categoria_ratio && (
              <div className="invalid-feedback">{errors.id_categoria_ratio.message as string}</div>
            )}
          </div>

          {/* SELECTOR DE PARÁMETRO */}
          <div className="mb-3">
            <label className="form-label">Parámetro</label>
            <select
              className={`form-select ${errors.id_parametro_sector ? 'is-invalid' : ''}`}
              {...register('id_parametro_sector', { required: 'Debe seleccionar un parámetro' })}
            >
              <option value="">-- Seleccionar Parámetro --</option>
              {parametros.map((param) => (
                <option key={param.idParametroSector} value={param.idParametroSector}>
                  {param.nombreRatio}
                </option>
              ))}
            </select>
            {errors.id_parametro_sector && (
              <div className="invalid-feedback">{errors.id_parametro_sector.message as string}</div>
            )}
          </div>
          <div className="mb-3">
            <label className="form-label">Año</label>
            <input
              type="number"
              placeholder="Ej: 2025"
              className={`form-control ${errors.anio_ratio ? 'is-invalid' : ''}`}
              {...register('anio_ratio', { required: 'El año es obligatorio' })}
            />
            {errors.anio_ratio && <div className="invalid-feedback">{errors.anio_ratio.message as string}</div>}
          </div>

          <div className="mb-3">
            <label className="form-label">Período</label>
            <input
              type="text"
              placeholder="Ej: Anual, Trimestral"
              className={`form-control ${errors.periodo_ratio ? 'is-invalid' : ''}`}
              {...register('periodo_ratio', { required: 'El período es obligatorio' })}
            />
            {errors.periodo_ratio && <div className="invalid-feedback">{errors.periodo_ratio.message as string}</div>}
          </div>
        </Modal.Body>

        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonStyles.btnPrimary}>
            {isCreateMode ? 'Guardar Ratio' : 'Guardar Cambios'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default RatioFormModal
