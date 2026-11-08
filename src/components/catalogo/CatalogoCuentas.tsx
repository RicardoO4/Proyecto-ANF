'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FaInbox, FaSearch } from 'react-icons/fa'

import { empresaService } from '@/services/empresaService'
import {
  buildCuentaSecciones,
  catalogService,
  type CuentaFila,
  type ElementoCatalogo,
} from '@/services/catalogService'
import { getErrorMessage } from '@/services/api'
import { Notifier } from '@/utils/Notifier'

import styles from '@/styles/catalogo/Catalog.module.css'

type FiltroEstado = 'todas' | 'activas' | 'inactivas'
type AccionMasiva = 'activar' | 'desactivar'

const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export const CatalogoCuentas = () => {
  const [empresas, setEmpresas] = useState<{ empresaId: number; nombreEmpresa: string }[]>([])
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')

  const [elementos, setElementos] = useState<ElementoCatalogo[]>([])
  const [filas, setFilas] = useState<CuentaFila[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set())

  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const [accionMasiva, setAccionMasiva] = useState<AccionMasiva | null>(null)

  const selectAllRef = useRef<HTMLInputElement>(null)

  const procesando = pendingIds.size > 0 || accionMasiva !== null

  useEffect(() => {
    const loadEmpresas = async () => setEmpresas(await empresaService.getEmpresas())
    loadEmpresas().catch(() => Notifier.error('No se pudieron cargar las empresas.'))
  }, [])

  const cargarFilas = useCallback(async (empresaId: string, silent = false) => {
    if (!empresaId) return
    if (!silent) setIsLoading(true)
    try {
      const [master, activos] = await Promise.all([
        catalogService.getMasterNodes(),
        catalogService.getCatalogoActivoPorEmpresa(Number.parseInt(empresaId, 10)),
      ])
      const secciones = buildCuentaSecciones(master, activos)
      setElementos(secciones.elementos)
      setFilas(secciones.filas)
      setSeleccionadas((prev) => {
        const ids = new Set(secciones.filas.map((fila) => fila.cuentaId))
        return new Set([...prev].filter((id) => ids.has(id)))
      })
    } catch (error) {
      Notifier.error(getErrorMessage(error, 'No se pudo cargar el catálogo de cuentas.'))
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  const seleccionarEmpresa = (empresaId: string) => {
    setSelectedEmpresaId(empresaId)
    setBusqueda('')
    setFiltroEstado('todas')
    setSeleccionadas(new Set())
    if (empresaId) void cargarFilas(empresaId)
    else {
      setElementos([])
      setFilas([])
    }
  }

  const filasPorId = useMemo(() => new Map(filas.map((fila) => [fila.cuentaId, fila])), [filas])

  const visibles = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    const pasaEstado = (fila: CuentaFila) => {
      if (filtroEstado === 'activas') return fila.activa
      if (filtroEstado === 'inactivas') return !fila.activa
      return true
    }
    const coincide = (fila: CuentaFila) =>
      termino === '' ||
      normalizar(`${fila.codigoCuenta} ${fila.nombreCuenta}`).includes(termino)

    const ids = new Set<number>()
    for (const elemento of elementos) {
      if (elemento.tipo === 'cuenta' && pasaEstado(elemento.fila) && coincide(elemento.fila)) {
        ids.add(elemento.fila.cuentaId)
      }
    }

    if (termino !== '') {
      for (const elemento of elementos) {
        if (elemento.tipo !== 'grupo' || !coincide(elemento.fila)) continue
        for (const id of elemento.cuentaIds) {
          const fila = filasPorId.get(id)
          if (fila && pasaEstado(fila)) ids.add(id)
        }
      }
    }
    return ids
  }, [elementos, filasPorId, busqueda, filtroEstado])

  const elementosVisibles = useMemo(
    () =>
      elementos.filter((elemento) =>
        elemento.tipo === 'cuenta'
          ? visibles.has(elemento.fila.cuentaId)
          : elemento.cuentaIds.some((id) => visibles.has(id)),
      ),
    [elementos, visibles],
  )

  const filasVisibles = useMemo(
    () => filas.filter((fila) => visibles.has(fila.cuentaId)),
    [filas, visibles],
  )

  const totalActivas = useMemo(() => filas.filter((fila) => fila.activa).length, [filas])

  const seleccionadasFilas = useMemo(
    () => filas.filter((fila) => seleccionadas.has(fila.cuentaId)),
    [filas, seleccionadas],
  )
  const activables = seleccionadasFilas.filter((fila) => !fila.activa)
  const desactivables = seleccionadasFilas.filter((fila) => fila.activa && fila.idCatalogo !== null)

  const visiblesSeleccionadas = filasVisibles.filter((fila) => seleccionadas.has(fila.cuentaId)).length

  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate =
      visiblesSeleccionadas > 0 && visiblesSeleccionadas < filasVisibles.length
    selectAllRef.current.checked =
      filasVisibles.length > 0 && visiblesSeleccionadas === filasVisibles.length
  }, [visiblesSeleccionadas, filasVisibles.length])

  const alternarSeleccion = (cuentaId: number) => {
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      if (next.has(cuentaId)) next.delete(cuentaId)
      else next.add(cuentaId)
      return next
    })
  }

  const alternarSeleccionTodas = () => {
    const idsVisibles = filasVisibles.map((fila) => fila.cuentaId)
    const todasSeleccionadas =
      idsVisibles.length > 0 && idsVisibles.every((id) => seleccionadas.has(id))
    setSeleccionadas((prev) => {
      const next = new Set(prev)
      for (const id of idsVisibles) {
        if (todasSeleccionadas) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const alternarCuenta = async (fila: CuentaFila) => {
    if (!selectedEmpresaId || procesando) return

    setPendingIds((prev) => new Set(prev).add(fila.cuentaId))
    try {
      if (fila.activa) {
        if (fila.idCatalogo === null) {
          throw new Error('La cuenta activa no tiene un registro de catálogo asociado.')
        }
        await catalogService.desactivarCuentas({ catalogoIds: [fila.idCatalogo] })
        Notifier.success(`Cuenta ${fila.codigoCuenta} desactivada.`)
      } else {
        await catalogService.activarCuentas({
          empresaId: Number.parseInt(selectedEmpresaId, 10),
          cuentaIds: [fila.cuentaId],
        })
        Notifier.success(`Cuenta ${fila.codigoCuenta} activada.`)
      }
      await cargarFilas(selectedEmpresaId, true)
    } catch (error) {
      Notifier.error(getErrorMessage(error, 'No se pudo actualizar la cuenta.'))
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(fila.cuentaId)
        return next
      })
    }
  }

  const activarSeleccionadas = async () => {
    if (activables.length === 0 || !selectedEmpresaId) return
    setAccionMasiva('activar')
    try {
      await catalogService.activarCuentas({
        empresaId: Number.parseInt(selectedEmpresaId, 10),
        cuentaIds: activables.map((fila) => fila.cuentaId),
      })
      Notifier.success(
        activables.length === 1
          ? 'Cuenta activada correctamente.'
          : `${activables.length} cuentas activadas correctamente.`,
      )
      setSeleccionadas(new Set())
      await cargarFilas(selectedEmpresaId, true)
    } catch (error) {
      Notifier.error(getErrorMessage(error, 'No se pudieron activar las cuentas.'))
    } finally {
      setAccionMasiva(null)
    }
  }

  const desactivarSeleccionadas = async () => {
    if (desactivables.length === 0) return
    const resultado = await Notifier.confirm({
      title: `¿Desactivar ${desactivables.length} ${desactivables.length === 1 ? 'cuenta' : 'cuentas'}?`,
      text: 'Las cuentas dejarán de estar disponibles para esta empresa.',
      confirmButtonText: 'Sí, desactivar',
    })
    if (!resultado.isConfirmed) return

    setAccionMasiva('desactivar')
    try {
      await catalogService.desactivarCuentas({
        catalogoIds: desactivables.map((fila) => fila.idCatalogo as number),
      })
      Notifier.success(
        desactivables.length === 1
          ? 'Cuenta desactivada correctamente.'
          : `${desactivables.length} cuentas desactivadas correctamente.`,
      )
      setSeleccionadas(new Set())
      await cargarFilas(selectedEmpresaId, true)
    } catch (error) {
      Notifier.error(getErrorMessage(error, 'No se pudieron desactivar las cuentas.'))
    } finally {
      setAccionMasiva(null)
    }
  }

  const filtrosActivos = busqueda.trim() !== '' || filtroEstado !== 'todas'

  return (
    <div className={styles.viewWrapper}>
      <header className={styles.headerCard}>
        <div className={styles.titleBlock}>
          <h2>Catálogo de Cuentas</h2>
          <p>Active o desactive las cuentas que esta empresa usará en sus estados financieros.</p>
        </div>
        <div className={styles.selector}>
          <label htmlFor="empresa-select">Empresa</label>
          <select
            id="empresa-select"
            className={`form-select ${styles.select}`}
            value={selectedEmpresaId}
            onChange={(e) => seleccionarEmpresa(e.target.value)}
            disabled={procesando}
          >
            <option value="">-- Elija una empresa --</option>
            {empresas.map((emp) => (
              <option key={emp.empresaId} value={emp.empresaId}>
                {emp.nombreEmpresa}
              </option>
            ))}
          </select>
        </div>
      </header>

      {!selectedEmpresaId ? (
        <div className={styles.placeholder}>
          <FaInbox className={styles.placeholderIcon} aria-hidden="true" />
          <h3>Seleccione una empresa</h3>
          <p>El catálogo de cuentas se gestiona por empresa. Elija una para comenzar.</p>
        </div>
      ) : isLoading ? (
        <div className={styles.tableWrapper}>
          <div className={styles.loadingBox}>
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <span>Cargando catálogo...</span>
          </div>
        </div>
      ) : (
        <>
          <section className={styles.toolbar} aria-label="Filtros del catálogo">
            <div className={styles.searchBox}>
              <FaSearch className={styles.searchIcon} aria-hidden="true" />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Buscar por código o nombre..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                aria-label="Buscar cuenta por código o nombre"
              />
            </div>

            <div className={styles.segmented} role="group" aria-label="Filtrar por estado">
              {(
                [
                  { value: 'todas', label: 'Todas' },
                  { value: 'activas', label: 'Activas' },
                  { value: 'inactivas', label: 'Inactivas' },
                ] as const
              ).map((opcion) => (
                <button
                  key={opcion.value}
                  type="button"
                  className={filtroEstado === opcion.value ? styles.segmentActive : styles.segment}
                  aria-pressed={filtroEstado === opcion.value}
                  onClick={() => setFiltroEstado(opcion.value)}
                >
                  {opcion.label}
                </button>
              ))}
            </div>

            <div className={styles.counters}>
              <span className={styles.counter}>
                Total <strong>{filas.length}</strong>
              </span>
              <span className={`${styles.counter} ${styles.counterActivas}`}>
                Activas <strong>{totalActivas}</strong>
              </span>
              <span className={styles.counter}>
                Inactivas <strong>{filas.length - totalActivas}</strong>
              </span>
            </div>
          </section>

          {seleccionadas.size > 0 && (
            <div className={styles.bulkBar} role="region" aria-label="Acciones masivas">
              <span className={styles.bulkCount}>
                {seleccionadas.size}{' '}
                {seleccionadas.size === 1 ? 'cuenta seleccionada' : 'cuentas seleccionadas'}
              </span>
              <div className={styles.bulkActions}>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionPrimary}`}
                  onClick={activarSeleccionadas}
                  disabled={activables.length === 0 || procesando}
                >
                  Activar ({activables.length})
                </button>
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionSecondary}`}
                  onClick={desactivarSeleccionadas}
                  disabled={desactivables.length === 0 || procesando}
                >
                  Desactivar ({desactivables.length})
                </button>
                <button
                  type="button"
                  className={styles.clearSelection}
                  onClick={() => setSeleccionadas(new Set())}
                  disabled={procesando}
                >
                  Limpiar selección
                </button>
              </div>
            </div>
          )}

          <p className={styles.resultsInfo} role="status" aria-live="polite">
            Mostrando {visibles.size} de {filas.length} cuentas
          </p>

          <div className={styles.tableWrapper}>
            <table className={styles.table} aria-label="Catálogo de cuentas de la empresa">
              <thead>
                <tr>
                  <th scope="col" className={styles.checkboxCell}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className={styles.checkbox}
                      onChange={alternarSeleccionTodas}
                      aria-label="Seleccionar todas las cuentas visibles"
                      disabled={filasVisibles.length === 0 || procesando}
                    />
                  </th>
                  <th scope="col" className={styles.codigoCell}>
                    Código
                  </th>
                  <th scope="col">Cuenta</th>
                  <th scope="col" className={styles.estadoCell}>
                    Estado
                  </th>
                  <th scope="col" className={styles.toggleCell}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {elementosVisibles.map((elemento) => {
                  if (elemento.tipo === 'grupo') {
                    const idsGrupo = elemento.cuentaIds.filter((id) => visibles.has(id))
                    const totalGrupo = idsGrupo.length
                    const grupoSeleccionado =
                      idsGrupo.length > 0 && idsGrupo.every((id) => seleccionadas.has(id))

                    const alternarGrupo = () => {
                      setSeleccionadas((prev) => {
                        const next = new Set(prev)
                        for (const id of idsGrupo) {
                          if (grupoSeleccionado) next.delete(id)
                          else next.add(id)
                        }
                        return next
                      })
                    }

                    return (
                      <tr key={`grupo-${elemento.fila.cuentaId}`} className={styles.groupRow}>
                        <td className={styles.checkboxCell}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={grupoSeleccionado}
                            onChange={alternarGrupo}
                            aria-label={`Seleccionar las cuentas de ${elemento.fila.nombreCuenta}`}
                            disabled={idsGrupo.length === 0 || procesando}
                          />
                        </td>
                        <th scope="rowgroup" colSpan={4} className={styles.groupCell}>
                          <div className={styles.groupInner}>
                            <span className={styles.groupCode}>{elemento.fila.codigoCuenta}</span>
                            <span className={styles.groupName}>{elemento.fila.nombreCuenta}</span>
                            <span className={styles.groupCount}>
                              {totalGrupo} {totalGrupo === 1 ? 'cuenta' : 'cuentas'}
                            </span>
                            <div className={styles.groupControls}>
                              <span
                                className={`${styles.tag} ${
                                  elemento.fila.activa
                                    ? styles.estadoActiva
                                    : styles.estadoInactiva
                                }`}
                              >
                                {elemento.fila.activa ? 'Activa' : 'Inactiva'}
                              </span>
                              <div className="form-check form-switch m-0">
                                <input
                                  type="checkbox"
                                  role="switch"
                                  id={`grupo-switch-${elemento.fila.cuentaId}`}
                                  className={`form-check-input ${styles.switch}`}
                                  checked={elemento.fila.activa}
                                  onChange={() => alternarCuenta(elemento.fila)}
                                  disabled={
                                    procesando || pendingIds.has(elemento.fila.cuentaId)
                                  }
                                  aria-label={`${elemento.fila.activa ? 'Quitar del' : 'Incluir en el'} catálogo la cuenta acumulativa ${elemento.fila.codigoCuenta} ${elemento.fila.nombreCuenta}`}
                                />
                              </div>
                            </div>
                          </div>
                        </th>
                      </tr>
                    )
                  }

                  const fila = elemento.fila
                  const seleccionada = seleccionadas.has(fila.cuentaId)
                  return (
                    <tr
                      key={`cuenta-${fila.cuentaId}`}
                      className={seleccionada ? styles.rowSelected : undefined}
                    >
                      <td className={styles.checkboxCell}>
                        <input
                          type="checkbox"
                          className={styles.checkbox}
                          checked={seleccionada}
                          onChange={() => alternarSeleccion(fila.cuentaId)}
                          aria-label={`Seleccionar la cuenta ${fila.codigoCuenta} ${fila.nombreCuenta}`}
                          disabled={procesando}
                        />
                      </td>
                      <td className={`${styles.codigoCell} ${styles.codigo}`}>{fila.codigoCuenta}</td>
                      <td className={styles.nombre} title={fila.nombreCuenta}>
                        {fila.nombreCuenta}
                      </td>
                      <td className={styles.estadoCell}>
                        <span
                          className={`${styles.tag} ${styles.estadoPill} ${
                            fila.activa ? styles.estadoActiva : styles.estadoInactiva
                          }`}
                        >
                          <span className={styles.dot} aria-hidden="true" />
                          {fila.activa ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className={styles.toggleCell}>
                        <div className="form-check form-switch m-0 d-flex justify-content-center">
                          <input
                            type="checkbox"
                            role="switch"
                            id={`cuenta-switch-${fila.cuentaId}`}
                            className={`form-check-input ${styles.switch}`}
                            checked={fila.activa}
                            onChange={() => alternarCuenta(fila)}
                            disabled={procesando}
                            aria-label={`${fila.activa ? 'Desactivar' : 'Activar'} la cuenta ${fila.codigoCuenta} ${fila.nombreCuenta}`}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {elementosVisibles.length === 0 && (
                  <tr>
                    <td colSpan={5} className={styles.emptyCell}>
                      {filtrosActivos
                        ? 'No hay cuentas que coincidan con la búsqueda o los filtros.'
                        : 'No hay cuentas registradas en el catálogo maestro.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

export default CatalogoCuentas
