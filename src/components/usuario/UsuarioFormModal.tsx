'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from 'react-bootstrap'
import buttonStyles from '@/styles/shared/Button.module.css'
import modalStyles from '@/styles/shared/Modal.module.css'
import type { UsuarioResponseDTO } from '@/types'

interface UsuarioFormModalProps {
  show: boolean
  onClose: () => void
  // eslint-disable-next-line no-unused-vars
  onSave: (data: { nombreUsuario: string; apellidoUsuario: string; userName: string; contrasena: string; rol: string }, id?: number) => void
  initialData: UsuarioResponseDTO | null
}

export const UsuarioFormModal: React.FC<UsuarioFormModalProps> = ({ show, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState({
    nombreUsuario: '',
    apellidoUsuario: '',
    userName: '',
    contrasena: '',
    rol: '',
  })

  useEffect(() => {
    if (initialData) {
      setFormData({
        nombreUsuario: initialData.nombreUsuario || '',
        apellidoUsuario: initialData.apellidoUsuario || '',
        userName: initialData.userName || '',
        contrasena: '',
        rol: initialData.rol || '',
      })
    } else {
      setFormData({
        nombreUsuario: '',
        apellidoUsuario: '',
        userName: '',
        contrasena: '',
        rol: '',
      })
    }
  }, [initialData, show])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData, initialData?.usuarioId)
  }

  return (
    <Modal show={show} onHide={onClose} centered>
      <form onSubmit={handleSubmit}>
        <Modal.Header className={modalStyles.modalHeader}>
          <Modal.Title className={modalStyles.modalTitle}>
            {initialData ? 'Editar Usuario' : 'Nuevo Usuario'}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-3">
            <label className="form-label">Nombre:</label>
            <input
              type="text"
              name="nombreUsuario"
              className="form-control"
              value={formData.nombreUsuario}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Apellido:</label>
            <input
              type="text"
              name="apellidoUsuario"
              className="form-control"
              value={formData.apellidoUsuario}
              onChange={handleChange}
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Nombre de usuario:</label>
            <input
              type="text"
              name="userName"
              className="form-control"
              value={formData.userName}
              onChange={handleChange}
              required
            />
          </div>

          {!initialData && (
            <div className="mb-3">
              <label className="form-label">Contraseña:</label>
              <input
                type="password"
                name="contrasena"
                className="form-control"
                value={formData.contrasena}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className="mb-3">
            <label className="form-label">Rol:</label>
            <select
              name="rol"
              className="form-select"
              value={formData.rol}
              onChange={handleChange}
              required
            >
              <option value="">Seleccione...</option>
              <option value="ADMIN">ADMIN</option>
              <option value="USER">USER</option>
            </select>
          </div>
        </Modal.Body>

        <Modal.Footer className={modalStyles.modalFooter}>
          <button type="button" className={buttonStyles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={buttonStyles.btnPrimary}>
            Guardar
          </button>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export default UsuarioFormModal
