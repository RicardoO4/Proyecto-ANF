'use client'

import React, { useCallback, useEffect, useState } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import EmpresaFija from '@/components/shared/EmpresaFija'
import Tabla from '@/components/shared/Tabla'
import { ProductoFormModal } from '@/components/inventario/ProductoFormModal'
import { inventarioSubMenuLinks } from '@/config/menuConfig'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import {
  inventarioService,
  type ProductoInput,
  type ProductoInventario,
} from '@/services/inventarioService'
import { getErrorMessage } from '@/services/api'
import { formatMoney } from '@/lib/formatoMonetario'
import { Notifier } from '@/utils/Notifier'
import styles from '@/styles/inventario/Inventario.module.css'

export const Productos = () => {
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const { empresa, error: errorEmpresa } = useEmpresaPrincipal((e) => setEmpresaId(e.empresaId))
  const [productos, setProductos] = useState<ProductoInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ProductoInventario | null>(null)

  const cargar = useCallback(async (id: number) => {
    setLoading(true)
    try {
      setProductos(await inventarioService.getProductos(id))
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudieron cargar los productos.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (empresaId == null) return
    void Promise.resolve().then(() => cargar(empresaId))
  }, [empresaId, cargar])

  const recargar = () => {
    if (empresaId != null) void cargar(empresaId)
  }

  const handleNuevo = () => {
    setEditando(null)
    setModalOpen(true)
  }

  const handleEditar = (producto: ProductoInventario) => {
    setEditando(producto)
    setModalOpen(true)
  }

  const handleGuardar = async (payload: ProductoInput, id?: number) => {
    if (empresaId == null) return
    const toastId = Notifier.loading('Guardando producto...')
    try {
      if (id != null) {
        await inventarioService.updateProducto(id, payload)
      } else {
        await inventarioService.createProducto(payload)
      }
      Notifier.success(id != null ? 'Producto actualizado.' : 'Producto creado.')
      setModalOpen(false)
      recargar()
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudo guardar el producto.'))
    } finally {
      Notifier.dismiss(String(toastId))
    }
  }

  const handleEliminar = async (producto: ProductoInventario) => {
    if (empresaId == null) return
    const confirmacion = await Notifier.confirm({
      title: `¿Eliminar "${producto.nombre}"?`,
      text: 'También se eliminarán sus movimientos y detalle de ventas.',
    })
    if (!confirmacion.isConfirmed) return
    const toastId = Notifier.loading('Eliminando producto...')
    try {
      await inventarioService.deleteProducto(producto.idProducto, empresaId)
      Notifier.success('Producto eliminado.')
      recargar()
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudo eliminar el producto.'))
    } finally {
      Notifier.dismiss(String(toastId))
    }
  }

  const columnas = [
    { Header: 'SKU', accessor: 'codigoSku' },
    { Header: 'Nombre', accessor: 'nombre' },
    {
      Header: 'Costo unitario ($)',
      accessor: (f: ProductoInventario) => formatMoney(f.costoUnitario),
    },
    {
      Header: 'Stock actual',
      accessor: (f: ProductoInventario) => String(Math.round(Number(f.stockActual))),
    },
    {
      Header: 'Estado',
      accessor: (f: ProductoInventario) => (f.activo ? 'Activo' : 'Inactivo'),
    },
  ]

  return (
    <div className={styles.page}>
      <SubMenu links={inventarioSubMenuLinks} />
      <div className={styles.empresa}>
        <label htmlFor="empresa-inventario">Empresa</label>
        <EmpresaFija
          id="empresa-inventario"
          empresa={empresa}
          error={errorEmpresa}
          className="form-select"
        />
      </div>
      {loading ? (
        <p>Cargando productos...</p>
      ) : (
        <Tabla
          titulo="Productos"
          textoBotonNuevo="Nuevo Producto"
          onNuevoClick={handleNuevo}
          columnas={columnas}
          datos={productos}
          enEditar={handleEditar}
          enEliminar={handleEliminar}
        />
      )}
      <ProductoFormModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleGuardar}
        initialData={editando}
        empresaId={empresaId ?? 0}
      />
    </div>
  )
}

export default Productos
