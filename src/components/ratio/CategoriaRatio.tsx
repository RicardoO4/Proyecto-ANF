'use client'

import React, { useState, useEffect } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import { sectoresSubMenuLinks } from '@/config/menuConfig'
import Tabla from '@/components/shared/Tabla'
import { CategoriaRatioFormModal } from '@/components/ratio/CategoriaRatioFormModal'
import { Notifier } from '@/utils/Notifier'
import { categoriasRatio, tiposRatio as tiposRatioService, type CategoriaRatioData } from '@/services/ratioService'

export const CategoriaRatio = () => {
  const [categoriasRatioList, setCategoriasRatioList] = useState<CategoriaRatioData[]>([])
  const [tiposRatio, setTiposRatio] = useState<{ id_tipo_ratio: number; nombre_ratio: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCategoria, setEditingCategoria] = useState<{
    id: number
    nombre: string
    descripcion: string | null
    idTipoRatio: number
  } | null>(null)

  // Carga ambos conjuntos de datos en paralelo
  const fetchData = async () => {
    try {
      setLoading(true)
      const [categoriasData, tiposData] = await Promise.all([
        categoriasRatio.getCategoriasRatio(),
        tiposRatioService.getTiposRatio(),
      ])
      setCategoriasRatioList(categoriasData)
      setTiposRatio(tiposData)
    } catch (error) {
      Notifier.error('No se pudieron cargar los datos necesarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const columnas = [
    { Header: 'ID', accessor: 'idCategoriaRatio' },
    { Header: 'Nombre de la Categoría', accessor: 'nombreTipo' },
    // Quirk preserved: this column reads 'nombre_ratio' which does not exist
    // on the category rows (renders empty), exactly as in the original.
    { Header: 'Tipo de Ratio', accessor: 'nombre_ratio' as string },
    { Header: 'Descripción', accessor: 'descripcion' },
  ]

  const handleNuevaCategoria = () => {
    setEditingCategoria(null)
    setIsModalOpen(true)
  }

  const handleEditar = (categoria: CategoriaRatioData) => {
    setEditingCategoria({
      // Mapear todos los datos necesarios para el formulario, incluyendo el ID del tipo
      id: categoria.idCategoriaRatio,
      nombre: categoria.nombreTipo,
      descripcion: categoria.descripcion,
      idTipoRatio: categoria.idTipoRatio as unknown as number,
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  const handleSave = async (formData: Record<string, string>, id?: number) => {
    // Payload con el campo 'idTipoRatio'
    const payload = {
      nombreTipo: formData.nombre,
      descripcion: formData.descripcion,
      // El valor del select viene como string, lo convertimos a número
      idTipoRatio: parseInt(formData.idTipoRatio, 10),
    }

    const isEditing = !!id
    const loadingToastId = Notifier.loading(isEditing ? 'Actualizando...' : 'Guardando...')

    try {
      if (isEditing) {
        await categoriasRatio.updateCategoriaRatio(id, payload)
      } else {
        await categoriasRatio.createCategoriaRatio(payload)
      }
      Notifier.dismiss(String(loadingToastId))
      Notifier.success(`¡Categoría ${isEditing ? 'actualizada' : 'creada'} exitosamente!`)
      handleCloseModal()
      fetchData() // Volvemos a cargar todo para refrescar la tabla
    } catch (error) {
      Notifier.dismiss(String(loadingToastId))
      Notifier.error(`Error al ${isEditing ? 'actualizar' : 'crear'}.`)
    }
  }

  const handleEliminar = async (categoria: CategoriaRatioData) => {
    const result = await Notifier.confirm({
      title: `¿Eliminar "${categoria.nombreTipo}"?`,
      text: 'Esta acción no se puede deshacer.',
    })

    if (result.isConfirmed) {
      const loadingToastId = Notifier.loading('Eliminando...')
      try {
        await categoriasRatio.deleteCategoriaRatio(categoria.idCategoriaRatio)
        Notifier.dismiss(String(loadingToastId))
        Notifier.success('Categoría eliminada.')
        fetchData()
      } catch (error) {
        Notifier.dismiss(String(loadingToastId))
        Notifier.error('No se pudo eliminar la categoría.')
      }
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <SubMenu links={sectoresSubMenuLinks} />

      <div style={{ marginTop: '2rem' }}>
        {loading ? (
          <p>Cargando datos...</p>
        ) : (
          <Tabla
            titulo="Gestión de Categorías"
            textoBotonNuevo="Nueva Categoría"
            columnas={columnas}
            datos={categoriasRatioList as unknown as Record<string, unknown>[]}
            enEditar={handleEditar}
            enEliminar={handleEliminar}
            onNuevoClick={handleNuevaCategoria}
          />
        )}
      </div>

      <CategoriaRatioFormModal
        show={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        initialData={editingCategoria}
        tiposRatio={tiposRatio}
      />
    </div>
  )
}

export default CategoriaRatio
