'use client'

import React, { useEffect, useRef, useState } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import EmpresaFija from '@/components/shared/EmpresaFija'
import Tabla from '@/components/shared/Tabla'
import { inventarioSubMenuLinks } from '@/config/menuConfig'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import {
  inventarioService,
  type ModelosInventarioResponse,
} from '@/services/inventarioService'
import { getErrorMessage } from '@/services/api'
import { formatMoney } from '@/lib/formatoMonetario'
import { Notifier } from '@/utils/Notifier'
import styles from '@/styles/inventario/Inventario.module.css'

const ANIO_MINIMO = 2023
const ANIO_MAXIMO = 2100

export const ModelosInventario = () => {
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const { empresa, error: errorEmpresa } = useEmpresaPrincipal((e) => setEmpresaId(e.empresaId))
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [anioInput, setAnioInput] = useState(String(anioActual))
  const [modelos, setModelos] = useState<ModelosInventarioResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const empresaInicializadaRef = useRef<number | null>(null)

  useEffect(() => {
    if (empresaId == null) return
    let activo = true
    inventarioService
      .getModelos(empresaId, anio)
      .then((data: ModelosInventarioResponse) => {
        if (!activo) return
        if (data.aniosDisponibles.length === 0) {
          empresaInicializadaRef.current = empresaId
          setModelos(null)
          setLoading(false)
          return
        }
        if (
          empresaInicializadaRef.current !== empresaId &&
          !data.aniosDisponibles.includes(data.anio)
        ) {
          empresaInicializadaRef.current = empresaId
          const ultimoAnio = data.aniosDisponibles[0]
          setAnio(ultimoAnio)
          setAnioInput(String(ultimoAnio))
          return
        }
        empresaInicializadaRef.current = empresaId
        setModelos(data)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (activo) {
          setModelos(null)
          setLoading(false)
          Notifier.error(getErrorMessage(err, 'No se pudieron calcular los modelos.'))
        }
      })
    return () => {
      activo = false
    }
  }, [empresaId, anio])

  const recalcular = () => {
    const valor = Number(anioInput)
    if (!Number.isInteger(valor) || valor < ANIO_MINIMO || valor > ANIO_MAXIMO) {
      Notifier.error(`Ingrese un año entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}.`)
      return
    }
    setAnio(valor)
  }

  const columnasABC = [
    { Header: 'SKU', accessor: 'codigoSku' },
    { Header: 'Producto', accessor: 'nombre' },
    {
      Header: 'Demanda anual',
      accessor: (f: ModelosInventarioResponse['abc'][number]) => Number(f.demandaAnual).toFixed(0),
    },
    {
      Header: 'Costo unitario ($)',
      accessor: (f: ModelosInventarioResponse['abc'][number]) => formatMoney(f.costoUnitario),
    },
    {
      Header: 'Valor anual ($)',
      accessor: (f: ModelosInventarioResponse['abc'][number]) => formatMoney(f.valorAnual),
    },
    {
      Header: 'Acumulado %',
      accessor: (f: ModelosInventarioResponse['abc'][number]) => Number(f.acumulado).toFixed(2),
    },
    { Header: 'Clase', accessor: 'clase' },
  ]

  const columnasEOQ = [
    { Header: 'SKU', accessor: 'codigoSku' },
    { Header: 'Producto', accessor: 'nombre' },
    {
      Header: 'Demanda',
      accessor: (f: ModelosInventarioResponse['eoq'][number]) => Number(f.demandaAnual).toFixed(0),
    },
    {
      Header: 'H unitario ($)',
      accessor: (f: ModelosInventarioResponse['eoq'][number]) => formatMoney(f.costoMantenimiento),
    },
    {
      Header: 'EOQ',
      accessor: (f: ModelosInventarioResponse['eoq'][number]) => Number(f.loteEconomico).toFixed(2),
    },
    {
      Header: 'Pedidos/año',
      accessor: (f: ModelosInventarioResponse['eoq'][number]) => Number(f.pedidosAnuales).toFixed(2),
    },
  ]

  const columnasReorden = [
    { Header: 'SKU', accessor: 'codigoSku' },
    { Header: 'Producto', accessor: 'nombre' },
    {
      Header: 'Consumo diario',
      accessor: (f: ModelosInventarioResponse['reorden'][number]) =>
        Number(f.consumoDiario).toFixed(2),
    },
    {
      Header: 'Lead time',
      accessor: (f: ModelosInventarioResponse['reorden'][number]) => String(f.leadTimeDias),
    },
    {
      Header: 'Punto de reorden',
      accessor: (f: ModelosInventarioResponse['reorden'][number]) => Number(f.puntoReorden).toFixed(2),
    },
    {
      Header: 'Stock actual',
      accessor: (f: ModelosInventarioResponse['reorden'][number]) => String(Math.round(Number(f.stockActual))),
    },
    {
      Header: 'Reposición sugerida',
      accessor: (f: ModelosInventarioResponse['reorden'][number]) =>
        Number(f.reposicionSugerida).toFixed(2),
    },
  ]

  return (
    <div className={styles.page}>
      <SubMenu links={inventarioSubMenuLinks} />
      <div className={styles.empresa}>
        <label htmlFor="empresa-modelos">Empresa</label>
        <EmpresaFija
          id="empresa-modelos"
          empresa={empresa}
          error={errorEmpresa}
          className="form-select"
        />
      </div>
      <div className={styles.acciones}>
        <label>
          Año
          <input
            type="number"
            min={ANIO_MINIMO}
            max={ANIO_MAXIMO}
            step={1}
            value={anioInput}
            onChange={(e) => setAnioInput(e.target.value)}
          />
        </label>
        <button type="button" className="btn-primary" onClick={recalcular}>
          Calcular
        </button>
      </div>

      {loading ? (
        <p>Calculando modelos...</p>
      ) : !modelos ? (
        <p className={styles.aviso}>No hay datos para mostrar.</p>
      ) : (
        <>
          <div className={styles.supuestos}>
            <span><strong>Año:</strong> {modelos.anio}</span>
            <span><strong>S ($):</strong> {formatMoney(modelos.supuestos.costoPedido)}</span>
            <span>
              <strong>h:</strong> {Number(modelos.supuestos.tasaMantenimiento).toFixed(4)}
            </span>
            <span><strong>Lead time:</strong> {modelos.supuestos.leadTimeDias} días</span>
            <span><strong>Días/año:</strong> {modelos.supuestos.diasAnio}</span>
            <span>
              <strong>Cortes ABC:</strong> {Number(modelos.supuestos.corteA).toFixed(2)} /{' '}
              {Number(modelos.supuestos.corteB).toFixed(2)}
            </span>
          </div>

          <div className={styles.seccion}>
            <Tabla titulo="Clasificación ABC" columnas={columnasABC} datos={modelos.abc} />
          </div>
          <div className={styles.seccion}>
            <Tabla titulo="Lote Económico de Compra (EOQ)" columnas={columnasEOQ} datos={modelos.eoq} />
          </div>
          <div className={styles.seccion}>
            <Tabla titulo="Punto de Reorden" columnas={columnasReorden} datos={modelos.reorden} />
          </div>
        </>
      )}
    </div>
  )
}

export default ModelosInventario
