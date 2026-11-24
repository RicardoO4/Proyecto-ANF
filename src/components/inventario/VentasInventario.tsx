'use client'

import React, { useCallback, useEffect, useState } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import EmpresaFija from '@/components/shared/EmpresaFija'
import Tabla from '@/components/shared/Tabla'
import { VentaInventarioFormModal } from '@/components/inventario/VentaInventarioFormModal'
import { inventarioSubMenuLinks } from '@/config/menuConfig'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import {
  inventarioService,
  type ProductoInventario,
  type VentaInventario,
  type VentaInventarioInput,
} from '@/services/inventarioService'
import { getErrorMessage } from '@/services/api'
import { formatMoney } from '@/lib/formatoMonetario'
import { Notifier } from '@/utils/Notifier'
import styles from '@/styles/inventario/Inventario.module.css'

export const VentasInventario = () => {
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const { empresa, error: errorEmpresa } = useEmpresaPrincipal((e) => setEmpresaId(e.empresaId))
  const [ventas, setVentas] = useState<VentaInventario[]>([])
  const [productos, setProductos] = useState<ProductoInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  const cargar = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const [ventasResp, productosResp] = await Promise.all([
        inventarioService.getVentas(id),
        inventarioService.getProductos(id),
      ])
      setVentas(ventasResp)
      setProductos(productosResp.filter((producto) => producto.activo))
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudieron cargar las ventas de inventario.'))
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

  const handleGuardar = async (payload: VentaInventarioInput) => {
    const toastId = Notifier.loading('Guardando venta SKU...')
    try {
      await inventarioService.createVenta(payload)
      Notifier.success('Venta SKU registrada.')
      setModalOpen(false)
      recargar()
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudo registrar la venta SKU.'))
    } finally {
      Notifier.dismiss(String(toastId))
    }
  }

  const handleEliminar = async (venta: VentaInventario) => {
    if (empresaId == null) return
    const confirmacion = await Notifier.confirm({
      title: '¿Eliminar esta venta SKU?',
      text: 'Se eliminará la venta y su detalle de inventario. No afecta ventas mensuales ni contabilidad.',
    })
    if (!confirmacion.isConfirmed) return
    const toastId = Notifier.loading('Eliminando venta SKU...')
    try {
      await inventarioService.deleteVenta(venta.idDetalle, empresaId)
      Notifier.success('Venta SKU eliminada.')
      recargar()
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudo eliminar la venta SKU.'))
    } finally {
      Notifier.dismiss(String(toastId))
    }
  }

  const columnas = [
    { Header: 'Año', accessor: (f: VentaInventario) => String(f.anio) },
    { Header: 'SKU', accessor: (f: VentaInventario) => f.codigoSku ?? String(f.productoId) },
    { Header: 'Producto', accessor: (f: VentaInventario) => f.nombreProducto ?? '' },
    { Header: 'Cantidad', accessor: (f: VentaInventario) => String(f.cantidad) },
    { Header: 'Precio unit.', accessor: (f: VentaInventario) => formatMoney(f.precioUnitario) },
    { Header: 'Subtotal', accessor: (f: VentaInventario) => formatMoney(f.subtotal) },
    { Header: 'Observación', accessor: (f: VentaInventario) => f.observacion ?? '' },
  ]

  return (
    <div className={styles.page}>
      <SubMenu links={inventarioSubMenuLinks} />
      <div className={styles.empresa}>
        <label htmlFor="empresa-ventas-inventario">Empresa</label>
        <EmpresaFija
          id="empresa-ventas-inventario"
          empresa={empresa}
          error={errorEmpresa}
          className="form-select"
        />
      </div>
      {loading ? (
        <p>Cargando ventas SKU...</p>
      ) : (
        <Tabla
          titulo="Ventas por SKU"
          textoBotonNuevo="Nueva Venta SKU"
          onNuevoClick={() => setModalOpen(true)}
          columnas={columnas}
          datos={ventas}
          enEliminar={handleEliminar}
        />
      )}
      <VentaInventarioFormModal
        show={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleGuardar}
        productos={productos}
        empresaId={empresaId ?? 0}
      />
    </div>
  )
}

export default VentasInventario
