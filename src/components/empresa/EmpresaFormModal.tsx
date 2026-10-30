'use client'

import React, { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { Modal } from 'react-bootstrap'
import { sectorService } from '@/services/sectorService'
import { usuarioService } from '@/services/usuarioService'
import { MaskedInput } from '@/components/shared/MaskedInput'
import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import type { EmpresaResponseDTO } from '@/types'
import type { SectorResponse } from '@/services/sectorService'
import type { UsuarioResponseDTO } from '@/types'

interface EmpresaFormModalProps {
  show: boolean
  onClose: () => void
  // eslint-disable-next-line no-unused-vars
  onSave: (data: any, id?: number) => void
  initialData?: EmpresaResponseDTO | null
}

interface FormValues {
  nombreEmpresa: string
  empresaDui: string
  empresaNit: string
  empresaNrc: string
  usuarioId: string
  idSector: string
}

export const EmpresaFormModal = ({ show, onClose, onSave, initialData = null }: EmpresaFormModalProps) => {
  const isCreateMode = !initialData
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
  } = useForm<FormValues>()

  const [sectores, setSectores] = useState<SectorResponse[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioResponseDTO[]>([])

  useEffect(() => {
    const loadSelectData = async () => {
      try {
        const [sectoresData, usuariosData] = await Promise.all([sectorService.getSectores(), usuarioService.getUsuarios()])
        setSectores(sectoresData)
        setUsuarios(usuariosData)
      } catch (error) {
        console.error('Error cargando datos para los selectores', error)
      }
    }
    loadSelectData()
  }, [])

  useEffect(() => {
    if (show) {
      reset(
        (initialData as unknown) || {
          nombreEmpresa: '',
          empresaDui: '',
          empresaNit: '',
          empresaNrc: '',
          usuarioId: (initialData ? (initialData as any).usuarioId : '') || '',
          idSector: (initialData ? (initialData as any).idSector : '') || '',
        },
      )
    }
  }, [show, initialData, reset])

  const onSubmit = (data: FormValues) => {
    const payload = {
      ...data,
      usuarioId: parseInt(data.usuarioId, 10),
      idSector: parseInt(data.idSector, 10),
    }
    if (isNaN(payload.usuarioId) || isNaN(payload.idSector)) {
      console.error('Error: ID de usuario o sector no es un número válido.', payload)
      return // Detiene el envío
    }
    onSave(payload, initialData?.empresaId)
  }

  return (
    <Modal show={show} onHide={onClose} centered size="lg" contentClassName={modalStyles.modalContent}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>
            {isCreateMode ? 'Registrar Nueva Empresa' : 'Editar Empresa'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">Nombre de la Empresa</label>
            <input
              type="text"
              className={`form-control ${errors.nombreEmpresa ? 'is-invalid' : ''}`}
              {...register('nombreEmpresa', { required: 'El nombre es obligatorio' })}
            />
            {errors.nombreEmpresa && <div className="invalid-feedback">{errors.nombreEmpresa.message}</div>}
          </div>
          <div className="row">
            {/* --- CAMPOS CON MÁSCARA --- */}
            <div className="col-md-4 mb-3">
              <label className="form-label">DUI</label>
              <Controller
                name="empresaDui"
                control={control}
                render={({ field }) => <MaskedInput {...field} mask="00000000-0" className="form-control" />}
              />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">NIT</label>
              <Controller
                name="empresaNit"
                control={control}
                render={({ field }) => <MaskedInput {...field} mask="0000-000000-000-0" className="form-control" />}
              />
            </div>
            <div className="col-md-4 mb-3">
              <label className="form-label">NRC</label>
              <Controller
                name="empresaNrc"
                control={control}
                render={({ field }) => <MaskedInput {...field} mask="000000-0" className="form-control" />}
              />
            </div>
            {/* --- FIN DE CAMPOS CON MÁSCARA --- */}
          </div>
          <div className="row">
            {/* --- SELECTORES CON LÓGICA DE EDICIÓN --- */}
            <div className="col-md-6 mb-3">
              <label className="form-label">Sector</label>
              <select
                className={`form-select ${errors.idSector ? 'is-invalid' : ''}`}
                {...register('idSector', { required: 'Debe seleccionar un sector' })}
                disabled={!isCreateMode}
              >
                <option value="">Seleccione un sector...</option>
                {sectores.map((s) => (
                  <option key={s.idSector} value={s.idSector}>
                    {s.nombreSector}
                  </option>
                ))}
              </select>
              {errors.idSector && <div className="invalid-feedback">{errors.idSector.message}</div>}
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Usuario Asignado</label>
              <select
                className={`form-select ${errors.usuarioId ? 'is-invalid' : ''}`}
                {...register('usuarioId', { required: 'Debe asignar un usuario' })}
                disabled={!isCreateMode}
              >
                <option value="">Seleccione un usuario...</option>
                {usuarios.map((u) => (
                  <option key={u.usuarioId} value={u.usuarioId}>
                    {u.userName} ({u.nombreUsuario})
                  </option>
                ))}
              </select>
              {errors.usuarioId && <div className="invalid-feedback">{errors.usuarioId.message}</div>}
            </div>
            {/* --- FIN DE SELECTORES --- */}
          </div>
        </Modal.Body>
        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonStyles.btnPrimary}>
            {isCreateMode ? 'Guardar Empresa' : 'Guardar Cambios'}
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default EmpresaFormModal
