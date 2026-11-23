'use client'

import React, { useEffect, useState } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import EmpresaFija from '@/components/shared/EmpresaFija'
import Tabla from '@/components/shared/Tabla'
import { MovimientoFormModal } from '@/components/inventario/MovimientoFormModal'
import { inventarioSubMenuLinks } from '@/config/menuConfig'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import {
  inventarioService,
  type MovimientoInput,
  type MovimientoInventario,
  type ProductoInventario,
} from '@/services/inventarioService'
import { getErrorMessage } from '@/services/api'
import { Notifier } from '@/utils/Notifier'
import styles from '@/styles/inventario/Inventario.module.css'

export const Movimientos = () => {
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const { empresa, error: errorEmpresa } = useEmpresaPrincipal((e) => setEmpresaId(e.empresaId))
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([])
  const [productos, setProductos] = useState<ProductoInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const cargar = async (id: number) => {
    setLoading(true)
    try {
      const [movs, prods] = await Promise.all([
        inventarioService.getMovimientos(id),
        inventarioService.getProductos(id),
      ])
      setMovimientos(movs)
      setProductos(prods.filter((producto) => producto.activo))
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudieron cargar los movimientos.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (empresaId == null) return
    void Promise.resolve().then(() => cargar(empresaId))
  }, [empresaId])

  const recargar = () => {
    if (empresaId != null) void cargar(empresaId)
  }

  const handleGuardar = async (payload: MovimientoInput) => {
    const toastId = Notifier.loading('Guardando movimiento...')
    try {
      await inventarioService.createMovimiento(payload)
      Notifier.success('Movimiento registrado.')
      setModalOpen(false)
      recargar()
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudo registrar el movimiento.'))
    } finally {
      Notifier.dismiss(String(toastId))
    }
  }

  const handleEliminar = async (movimiento: MovimientoInventario) => {
    if (empresaId == null) return
    const confirmacion = await Notifier.confirm({
      title: '¿Eliminar este movimiento?',
      text: 'El stock del producto se ajustará automáticamente.',
    })
    if (!confirmacion.isConfirmed) return
    const toastId = Notifier.loading('Eliminando movimiento...')
    try {
      await inventarioService.deleteMovimiento(movimiento.idMovimiento, empresaId)
      Notifier.success('Movimiento eliminado.')
      recargar()
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudo eliminar el movimiento.'))
    } finally {
      Notifier.dismiss(String(toastId))
    }
  }

  const columnas = [
    { Header: 'Fecha', accessor: 'fecha' },
    {
      Header: 'Producto',
      accessor: (f: MovimientoInventario) => f.codigoSku ?? String(f.productoId),
    },
    { Header: 'Tipo', accessor: 'tipoMovimiento' },
    {
      Header: 'Cantidad',
      accessor: (f: MovimientoInventario) => String(Math.round(Number(f.cantidad))),
    },
    { Header: 'Observación', accessor: 'observacion' },
  ]

  return (
    <div className={styles.page}>
      <SubMenu links={inventarioSubMenuLinks} />
      <div className={styles.empresa}>
        <label htmlFor="empresa-movimientos">Empresa</label>
        <EmpresaFija
          id="empresa-movimientos"
          empresa={empresa}
          error={errorEmpresa}
          className="form-select"
        />
      </div>
      {loading ? (
        <p>Cargando movimientos...</p>
      ) : (
        <Tabla
          titulo="Movimientos de Inventario"
          textoBotonNuevo="Nuevo Movimiento"
          onNuevoClick={() => setModalOpen(true)}
          columnas={columnas}
          datos={movimientos}
          enEliminar={handleEliminar}
        />
      )}
      <MovimientoFormModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleGuardar}
        productos={productos}
        empresaId={empresaId ?? 0}
      />
    </div>
  )
}

export default Movimientos
