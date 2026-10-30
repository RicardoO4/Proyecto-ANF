'use client'

import React, { useState, useEffect } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import { sectoresSubMenuLinks } from '@/config/menuConfig'
import Tabla from '@/components/shared/Tabla'
import { TipoRatioFormModal } from '@/components/ratio/TipoRatioFormModal'
import { Notifier } from '@/utils/Notifier'
import { tiposRatio as tiposRatioService } from '@/services/ratioService'

export const TipoRatio = () => {
  const [tiposRatioState, setTiposRatioState] = useState<
    { id_tipo_ratio: number; codigo_ratio: string | null; nombre_ratio: string; descripcion: string | null; unidad_ratio: string | null }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRatio, setEditingRatio] = useState<{
    id: number
    codigo: string | null
    nombre: string
    descripcion: string | null
    unidad: string | null
  } | null>(null)

  // Obtiene los datos de la API
  const fetchTiposRatio = async () => {
    try {
      setLoading(true)
      const data = await tiposRatioService.getTiposRatio()
      setTiposRatioState(data)
    } catch (error) {
      Notifier.error('No se pudieron cargar los tipos de ratio.')
    } finally {
      setLoading(false)
    }
  }

  // Se ejecuta una vez cuando el componente se monta
  useEffect(() => {
    fetchTiposRatio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Columnas para la tabla (con accesores de la API)
  const columnas = [
    { Header: 'ID', accessor: 'id_tipo_ratio' },
    { Header: 'Código', accessor: 'codigo_ratio' },
    { Header: 'Nombre', accessor: 'nombre_ratio' },
    { Header: 'Descripción', accessor: 'descripcion' },
    { Header: 'Unidad', accessor: 'unidad_ratio' },
  ]

  const handleNuevoRatio = () => {
    setEditingRatio(null)
    setIsModalOpen(true)
  }

  const handleEditar = (
    ratio: { id_tipo_ratio: number; codigo_ratio: string | null; nombre_ratio: string; descripcion: string | null; unidad_ratio: string | null },
  ) => {
    // Mapeamos los datos de la API a los que espera el formulario
    setEditingRatio({
      id: ratio.id_tipo_ratio,
      codigo: ratio.codigo_ratio,
      nombre: ratio.nombre_ratio,
      descripcion: ratio.descripcion,
      unidad: ratio.unidad_ratio,
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  // Guardado (crear/editar) conectado a la API
  const handleSave = async (formData: Record<string, string>, id?: number) => {
    // Mapeamos los datos del formulario al formato que espera la API
    const payload = {
      codigo_ratio: formData.codigo,
      nombre_ratio: formData.nombre,
      descripcion: formData.descripcion,
      unidad_ratio: formData.unidad,
      id_categoria_ratio: 1, // Hardcodeado como en el ejemplo JSON
    }

    const isEditing = !!id
    const loadingToastId = Notifier.loading(isEditing ? 'Actualizando...' : 'Guardando...')

    try {
      if (isEditing) {
        await tiposRatioService.updateTipoRatio(id, payload)
      } else {
        await tiposRatioService.createTipoRatio(payload)
      }
      Notifier.dismiss(String(loadingToastId))
      Notifier.success(`¡Tipo de ratio ${isEditing ? 'actualizado' : 'creado'} exitosamente!`)
      handleCloseModal()
      fetchTiposRatio()
    } catch (error) {
      Notifier.dismiss(String(loadingToastId))
      Notifier.error(`Error al ${isEditing ? 'actualizar' : 'crear'}.`)
    }
  }

  // Eliminar conectado a la API
  const handleEliminar = async (ratio: { id_tipo_ratio: number; nombre_ratio: string }) => {
    const result = await Notifier.confirm({
      title: `¿Eliminar "${ratio.nombre_ratio}"?`,
      text: 'Esta acción no se puede deshacer.',
    })

    if (result.isConfirmed) {
      const loadingToastId = Notifier.loading('Eliminando...')
      try {
        await tiposRatioService.deleteTipoRatio(ratio.id_tipo_ratio)
        Notifier.dismiss(String(loadingToastId))
        Notifier.success('Tipo de ratio eliminado.')
        fetchTiposRatio()
      } catch (error) {
        Notifier.dismiss(String(loadingToastId))
        Notifier.error('No se pudo eliminar el tipo de ratio.')
      }
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <SubMenu links={sectoresSubMenuLinks} />
      <div style={{ marginTop: '1rem' }}>
        {loading ? (
          <p>Cargando datos...</p>
        ) : (
          <Tabla
            titulo="Gestión de Tipos de Ratio"
            textoBotonNuevo="Nuevo Tipo"
            columnas={columnas}
            datos={tiposRatioState as unknown as Record<string, unknown>[]}
            enEditar={handleEditar}
            enEliminar={handleEliminar}
            onNuevoClick={handleNuevoRatio}
          />
        )}
      </div>
      <TipoRatioFormModal
        show={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        initialData={editingRatio}
      />
    </div>
  )
}

export default TipoRatio
