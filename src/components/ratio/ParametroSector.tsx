'use client'

import React, { useState, useEffect } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import { sectoresSubMenuLinks } from '@/config/menuConfig'
import Tabla from '@/components/shared/Tabla'
import { ParametroSectorFormModal } from '@/components/ratio/ParametroSectorFormModal'
import { Notifier } from '@/utils/Notifier'
import { parametroSectorService, categoriasRatio, type CategoriaRatioData } from '@/services/ratioService'
import { sectorService } from '@/services/sectorService'
import type { ParametroSectorResponseDTO } from '@/types'
import type { SectorResponse } from '@/services/sectorService'

export const ParametroSector = () => {
  const [parametros, setParametros] = useState<
    (ParametroSectorResponseDTO & { nombreSector?: string; nombreCategoria?: string })[]
  >([])
  const [categorias, setCategorias] = useState<CategoriaRatioData[]>([])
  const [sectores, setSectores] = useState<SectorResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingParametro, setEditingParametro] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [parametrosData, categoriasData, sectoresData] = await Promise.all([
          parametroSectorService.getParametros(),
          categoriasRatio.getCategoriasRatio(),
          sectorService.getSectores(),
        ])

        // Mapeamos los datos para que sean planos
        const parametrosMapeados = (parametrosData as (ParametroSectorResponseDTO & {
          nombreSector?: string
          nombreCategoria?: string
        })[]).map((p) => ({
          ...p,
          nombreSector: p.sector?.nombre_sector || 'N/A',
          nombreCategoria: p.categoriaRatio?.nombre_categoria || 'N/A',
        }))

        setParametros(parametrosMapeados)
        setCategorias(categoriasData)
        setSectores(sectoresData)
      } catch (error) {
        Notifier.error('Error al cargar los datos iniciales.')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const columnas = [
    { Header: 'ID', accessor: 'idParametroSector' },
    { Header: 'Nombre Parámetro', accessor: 'nombreRatio' },
    { Header: 'Sector', accessor: 'nombreSector' },
    { Header: 'Valor', accessor: 'valorReferencia' },
    { Header: 'Año', accessor: 'anioReferencia' },
    { Header: 'Fuente', accessor: 'fuente' },
  ]

  const handleNuevo = () => {
    setEditingParametro(null)
    setIsModalOpen(true)
  }

  const handleEditar = (parametro: ParametroSectorResponseDTO) => {
    // Hacemos el mapeo de datos más seguro con optional chaining
    setEditingParametro({
      id: parametro.idParametroSector,
      nombreRatio: parametro.nombreRatio,
      valorReferencia: parametro.valorReferencia,
      fuente: parametro.fuente,
      anioReferencia: parametro.anioReferencia,
      id_sector: parametro.sector?.id_sector,
      id_categoria_ratio: parametro.categoriaRatio?.id_categoria_ratio,
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => setIsModalOpen(false)

  const handleSave = async (formData: Record<string, string | number>, id?: number) => {
    const payload: Record<string, unknown> = {
      ...formData,
      id_sector: parseInt(String(formData.id_sector), 10),
      id_categoria_ratio: parseInt(String(formData.id_categoria_ratio), 10),
    }
    delete payload.id

    const isEditing = !!id
    const toastId = Notifier.loading(isEditing ? 'Actualizando...' : 'Guardando...')

    try {
      if (isEditing) {
        await parametroSectorService.updateParametro(id, payload as never)
      } else {
        await parametroSectorService.createParametro(payload as never)
      }
      Notifier.success(`Parámetro ${isEditing ? 'actualizado' : 'creado'}.`)
      handleCloseModal()
      const data = await parametroSectorService.getParametros()
      setParametros(data as never)
    } catch (error) {
      Notifier.error(`Error al ${isEditing ? 'actualizar' : 'crear'}.`)
    } finally {
      Notifier.dismiss(String(toastId))
    }
  }

  const handleEliminar = async (parametro: ParametroSectorResponseDTO) => {
    const result = await Notifier.confirm({ title: `¿Eliminar "${parametro.nombreRatio}"?` })
    if (result.isConfirmed) {
      const toastId = Notifier.loading('Eliminando...')
      try {
        await parametroSectorService.deleteParametro(parametro.idParametroSector)
        Notifier.success('Parámetro eliminado.')
        const data = await parametroSectorService.getParametros()
        setParametros(data as never)
      } catch (error) {
        Notifier.error('No se pudo eliminar el parámetro.')
      } finally {
        Notifier.dismiss(String(toastId))
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
            titulo="Gestión de Parámetros por Sector"
            textoBotonNuevo="Nuevo Parámetro"
            columnas={columnas}
            datos={parametros as unknown as Record<string, unknown>[]}
            enEditar={handleEditar}
            enEliminar={handleEliminar}
            onNuevoClick={handleNuevo}
          />
        )}
      </div>

      <ParametroSectorFormModal
        show={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        initialData={editingParametro}
        categorias={categorias}
        sectores={sectores}
      />
    </div>
  )
}

export default ParametroSector
