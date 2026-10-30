'use client'

import React, { useState, useEffect } from 'react'
import { FaPlus, FaEdit, FaTrash } from 'react-icons/fa'
import SubMenu from '@/components/shared/SubMenu'
import { usuariosSubMenuLinks } from '@/config/menuConfig'
import { usuarioService } from '@/services/usuarioService'
import { Notifier } from '@/utils/Notifier'
import { UsuarioFormModal } from '@/components/usuario/UsuarioFormModal'
import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import type { UsuarioResponseDTO } from '@/types'

export const Usuarios = () => {
  const [usuarios, setUsuarios] = useState<UsuarioResponseDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUsuario, setEditingUsuario] = useState<UsuarioResponseDTO | null>(null)

  const fetchUsuarios = async () => {
    try {
      setLoading(true)
      setUsuarios(await usuarioService.getUsuarios())
    } catch (error) {
      Notifier.error('No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsuarios()
  }, [])

  const handleOpenCreateModal = () => {
    setEditingUsuario(null)
    setIsModalOpen(true)
  }
  const handleOpenEditModal = (usuario: UsuarioResponseDTO) => {
    setEditingUsuario(usuario)
    setIsModalOpen(true)
  }
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingUsuario(null)
  }

  const handleSave = async (data: Partial<UsuarioResponseDTO> & { contrasena?: string | null }, id?: number) => {
    const isEditing = !!id
    const toastId = Notifier.loading(isEditing ? 'Actualizando usuario...' : 'Creando usuario...')
    try {
      if (isEditing) {
        await usuarioService.updateUsuario(id, data)
      } else {
        await usuarioService.createUsuario(data)
      }
      Notifier.dismiss(toastId)
      Notifier.success(`¡Usuario ${isEditing ? 'actualizado' : 'creado'} correctamente!`)
      handleCloseModal()
      fetchUsuarios()
    } catch (err: any) {
      Notifier.dismiss(toastId)
      Notifier.error(err?.response?.data?.message || `Error al ${isEditing ? 'actualizar' : 'crear'} usuario.`)
    }
  }

  const handleDelete = async (usuario: UsuarioResponseDTO) => {
    const result = await Notifier.confirm({
      title: `¿Eliminar "${usuario.userName}"?`,
      text: 'Esta acción no se puede deshacer.',
    })
    if (result.isConfirmed) {
      const toastId = Notifier.loading('Eliminando usuario...')
      try {
        await usuarioService.deleteUsuario(usuario.usuarioId)
        Notifier.dismiss(toastId)
        Notifier.success('Usuario eliminado.')
        fetchUsuarios()
      } catch (error) {
        Notifier.dismiss(toastId)
        Notifier.error('No se pudo eliminar el usuario.')
      }
    }
  }

  return (
    <>
      <SubMenu links={usuariosSubMenuLinks} />
      <div className={viewStyles.viewContainer}>
        <div className={viewStyles.viewHeader}>
          <h2 className={viewStyles.viewTitle}>Gestión de Usuarios</h2>
          <button className={buttonStyles.btnPrimary} onClick={handleOpenCreateModal}>
            <FaPlus className="me-2" />
            Nuevo Usuario
          </button>
        </div>
        {loading ? (
          <p>Cargando...</p>
        ) : (
          <div className="table-responsive">
            <table className={viewStyles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Apellido</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.usuarioId}>
                    <td>{u.usuarioId}</td>
                    <td>{u.nombreUsuario}</td>
                    <td>{u.apellidoUsuario}</td>
                    <td>{u.userName}</td>
                    <td>{u.rol}</td>
                    <td className="text-end">
                      <button
                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconEdit} me-2`}
                        onClick={() => handleOpenEditModal(u)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconDelete}`}
                        onClick={() => handleDelete(u)}
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

      <UsuarioFormModal show={isModalOpen} onClose={handleCloseModal} onSave={handleSave} initialData={editingUsuario} />
    </>
  )
}

export default Usuarios
