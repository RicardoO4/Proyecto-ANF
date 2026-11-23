'use client'
import PeriodosPreliminares from '@/components/shared/PeriodosPreliminares'

import React, { useState, useEffect, useCallback } from 'react'
import SubMenu from '@/components/shared/SubMenu'
import { sectoresSubMenuLinks } from '@/config/menuConfig'
import Tabla from '@/components/shared/Tabla'
import { Notifier } from '@/utils/Notifier'

import { ratioService } from '@/services/ratioService'
import { RatioFormModal } from '@/components/ratio/RatioFormModal'
import { RatioDetailsModal } from '@/components/ratio/RatioDetailsModal'
import { categoriasRatio } from '@/services/ratioService'
import { parametroSectorService } from '@/services/ratioService'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import BotonResumenIA from '@/components/shared/BotonResumenIA'
import ActualizarIndicadores from './ActualizarIndicadores'
import recalculoStyles from '@/styles/ratio/ActualizarIndicadores.module.css'
import { apiClient, getErrorMessage } from '@/services/api'
import { INFO_CATEGORIA } from '@/lib/asistenteFinanciero'
import type { RatioResponseDTO, CategoriaRatioResponseDTO, ParametroSectorResponseDTO, EmpresaResponseDTO } from '@/types'

export const Ratio = () => {
  // --- Estados para los datos ---
  const [ratios, setRatios] = useState<RatioResponseDTO[]>([])
  const [categorias, setCategorias] = useState<CategoriaRatioResponseDTO[]>([])
  const [parametros, setParametros] = useState<ParametroSectorResponseDTO[]>([])
  // --- Monoempresa (A4): los ratios se filtran por la empresa principal ---
  const [filtroEmpresa, setFiltroEmpresa] = useState<string | null>(null)

  // --- Estados para la UI ---
  const [loading, setLoading] = useState(true)
  const [recalculando, setRecalculando] = useState(false)
  const [avisosRecalculo, setAvisosRecalculo] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingRatio, setEditingRatio] = useState<Record<string, unknown> | null>(null)

  // Estados para el modal de detalles
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [selectedRatioDetails, setSelectedRatioDetails] = useState<RatioResponseDTO | null>(null)

  // --- Carga de datos inicial y por filtro ---
  const fetchData = useCallback(async (nombreEmpresa: string) => {
    try {
      setLoading(true)
      const ratiosData = await ratioService.getRatios(nombreEmpresa)
      setRatios(ratiosData)
    } catch (error) {
      Notifier.error('No se pudieron cargar los ratios.')
    } finally {
      setLoading(false)
    }
  }, [])

  // --- Carga de datos para los menús desplegables (solo una vez) ---
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [categoriasData, parametrosData] = await Promise.all([
          categoriasRatio.getCategoriasRatio(),
          parametroSectorService.getParametros(),
        ])
        setCategorias(categoriasData as CategoriaRatioResponseDTO[])
        setParametros(parametrosData)
      } catch (error) {
        Notifier.error('No se pudieron cargar los datos para los formularios.')
      }
    }
    fetchDropdownData()
  }, [])

  const { empresa } = useEmpresaPrincipal((e) => {
    setFiltroEmpresa(e.nombreEmpresa)
    void fetchData(e.nombreEmpresa)
  })
  const empresas: EmpresaResponseDTO[] = empresa
    ? [{ empresaId: empresa.empresaId, nombreEmpresa: empresa.nombreEmpresa } as EmpresaResponseDTO]
    : []

  const etiquetaUnidad = (categoria?: string | null) => {
    const unidad = categoria ? INFO_CATEGORIA[categoria]?.unidad : undefined
    if (unidad === 'porcentaje') return '%'
    if (unidad === 'dias') return 'días'
    return unidad ?? 'N/A'
  }

  const columnas = [
    { Header: 'ID', accessor: 'id_ratio' },
    {
      Header: 'INDICADOR',
      accessor: (row: RatioResponseDTO) => row.categoriaRatio?.nombre_categoria ?? 'N/A',
    },
    {
      Header: 'VALOR CALCULADO',
      accessor: (row: RatioResponseDTO) =>
        row.valor_calculado === null ? 'Sin cálculo' : Number(row.valor_calculado).toFixed(4),
    },
    {
      Header: 'UNIDAD',
      accessor: (row: RatioResponseDTO) => etiquetaUnidad(row.categoriaRatio?.nombre_categoria),
    },
    {
      Header: 'REFERENCIA SECTORIAL',
      accessor: (row: RatioResponseDTO) =>
        row.parametroSector?.valor_referencia != null
          ? Number(row.parametroSector.valor_referencia).toFixed(4)
          : 'Sin referencia sectorial (cálculo realizado)',
    },
    {
      Header: 'AÑO REFERENCIA',
      accessor: (row: RatioResponseDTO) => row.parametroSector?.anio_referencia ?? 'N/A',
    },
    {
      Header: 'AÑO CÁLCULO',
      accessor: (row: RatioResponseDTO) => row.anio_ratio ?? 'N/A',
    },
    { Header: 'PERÍODO', accessor: 'periodo_ratio' },
  ]

  // --- Manejadores de eventos del Modal de Formulario ---
  const handleNuevoRatio = () => {
    setEditingRatio(null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingRatio(null)
  }

  const handleEditar = (ratio: RatioResponseDTO) => {
    setEditingRatio({
      id_ratio: ratio.id_ratio,
      empresa_id: ratio.empresa.empresa_id,
      id_categoria_ratio: ratio.categoriaRatio!.id_categoria_ratio,
      id_parametro_sector: ratio.parametroSector!.id_parametro_sector,
      anio_ratio: ratio.anio_ratio,
      periodo_ratio: ratio.periodo_ratio,
    })
    setIsModalOpen(true)
  }

  // Lógica de ver: abre el modal de detalles
  const handleVer = (ratio: RatioResponseDTO) => {
    setSelectedRatioDetails(ratio)
    setIsDetailsModalOpen(true)
  }

  // --- Lógica de Calcular ---
  const handleCalcular = async (ratio: RatioResponseDTO) => {
    const categoriaNombre = ratio.categoriaRatio?.nombre_categoria
    const ratioId = ratio.id_ratio

    if (!categoriaNombre) {
      Notifier.error('La categoría del ratio no está definida. No se puede calcular.')
      return
    }

    // El "mapa" que conecta el nombre de la categoría con la función de servicio.
    const calculoPorCategoria: Record<string, (id: number) => Promise<RatioResponseDTO>> = {
      'Razón de circulante o liquidez corriente': (id) => ratioService.calculateLiquidezRatio(id),
      'Razón de capital de trabajo': (id) => ratioService.calculateCapitalTrabajoRatio(id),
      'Razón de efectivo': (id) => ratioService.calculateEfectivoRatio(id),
      'Razón de rotación de cuentas por cobrar': (id) => ratioService.calculateRotacionCuentasPorCobrarRatio(id),
      // NOTE: el nombre debe coincidir EXACTAMENTE con expectedCategory en
      // ratios.ts ('Período medio de cobranza') o el endpoint rechaza el cálculo.
      'Período medio de cobranza': (id) => ratioService.calculatePeriodoCobranzaRatio(id),
      'Índice de rotación de activos totales': (id) => ratioService.calculateRotacionActivosTotalesRatio(id),
      'Índice de rotación de activos fijos': (id) => ratioService.calculateRotacionActivosFijosRatio(id),
      'Índice de margen bruto': (id) => ratioService.calculateMargenBrutoRatio(id),
      'Índice de margen operativo': (id) => ratioService.calculateMargenOperativoRatio(id),
      // Módulo C (C1). El nombre debe coincidir EXACTAMENTE con el
      // expectedCategory del calculador en lib/ratios.ts.
      'Prueba ácida': (id) => ratioService.calculatePruebaAcidaRatio(id),
      'Grado de endeudamiento': (id) => ratioService.calculateEndeudamientoRatio(id),
      'Grado de propiedad': (id) => ratioService.calculatePropiedadRatio(id),
      'Razón de endeudamiento patrimonial': (id) =>
        ratioService.calculateEndeudamientoPatrimonialRatio(id),
      // C1: Apalancamiento faltante
      'Razón de cobertura de intereses': (id) => ratioService.calculateCoberturaInteresesRatio(id),
      // C2: Rentabilidad
      'Índice de margen neto': (id) => ratioService.calculateMargenNetoRatio(id),
      'Rendimiento sobre activos (ROA)': (id) => ratioService.calculateROARatio(id),
      'Rendimiento sobre capital contable (ROE)': (id) => ratioService.calculateROERatio(id),
      'Análisis DuPont': (id) => ratioService.calculateDuPontRatio(id),
      // C3: Ciclos Operativos
      'Razón de rotación de inventarios': (id) => ratioService.calculateRotacionInventariosRatio(id),
      'Edad promedio del inventario': (id) => ratioService.calculateEdadPromedioInventarioRatio(id),
      'Período medio de pago': (id) => ratioService.calculatePeriodoPagoRatio(id),
      'Ciclo operativo': (id) => ratioService.calculateCicloOperativoRatio(id),
      'Ciclo de conversión de efectivo': (id) => ratioService.calculateCCERatio(id),
    }

    const funcionDeCalculo = calculoPorCategoria[categoriaNombre]

    if (!funcionDeCalculo) {
      Notifier.warning(`La categoría "${categoriaNombre}" aún no tiene una función de cálculo implementada.`)
      return
    }

    const loadingToastId = Notifier.loading(`Calculando ratio ID: ${ratioId} (${categoriaNombre})...`)

    try {
      await funcionDeCalculo(ratioId)
      Notifier.dismiss(String(loadingToastId))
      Notifier.success(`¡Ratio ID: ${ratioId} calculado exitosamente!`)
      fetchData(filtroEmpresa ?? '')
    } catch (error: unknown) {
      Notifier.dismiss(String(loadingToastId))
      const err = error as { response?: { data?: { message?: string } } }
      const errorMessage = err.response?.data?.message || `No se pudo calcular el ratio de ${categoriaNombre}.`
      Notifier.error(errorMessage)
      console.error(`Error en handleCalcular para la categoría ${categoriaNombre}:`, error)
    }
  }

  // --- Lógica de Guardar ---
  const handleSave = async (formData: Record<string, string>, id?: number) => {
    const isEditing = !!id
    const payload = {
      anio_ratio: parseInt(formData.anio_ratio, 10),
      periodo_ratio: formData.periodo_ratio,
      empresa_id: parseInt(formData.empresa_id, 10),
      id_categoria_ratio: parseInt(formData.id_categoria_ratio, 10),
      id_parametro_sector: parseInt(formData.id_parametro_sector, 10),
    }

    const loadingToastId = Notifier.loading(isEditing ? 'Actualizando ratio...' : 'Guardando nuevo ratio...')

    try {
      if (isEditing) {
        await ratioService.updateRatio(id, payload)
      } else {
        await ratioService.createRatio(payload)
      }
      Notifier.dismiss(String(loadingToastId))
      Notifier.success(`¡Ratio ${isEditing ? 'actualizado' : 'creado'} exitosamente!`)

      handleCloseModal()
      fetchData(filtroEmpresa ?? '')
    } catch (error) {
      Notifier.dismiss(String(loadingToastId))
      Notifier.error(`Error al ${isEditing ? 'actualizar' : 'crear'} el ratio.`)
      console.error('Error en handleSave:', error)
    }
  }

  // --- Lógica de Eliminar ---
  const handleEliminar = async (ratio: RatioResponseDTO) => {
    const result = await Notifier.confirm({
      title: '¿Estás seguro de eliminar el ratio?',
      text: `Se eliminará el registro del año ${ratio.anio_ratio} para la empresa ${ratio.empresa?.nombre_empresa}. Esta acción no se puede deshacer.`,
    })

    if (result.isConfirmed) {
      const loadingToastId = Notifier.loading('Eliminando...')
      try {
        await ratioService.deleteRatio(ratio.id_ratio)
        Notifier.dismiss(String(loadingToastId))
        Notifier.success('Ratio eliminado correctamente.')
        fetchData(filtroEmpresa ?? '')
      } catch (error) {
        Notifier.dismiss(String(loadingToastId))
        Notifier.error('No se pudo eliminar el ratio. Inténtalo de nuevo.')
        console.error('Error en handleEliminar:', error)
      }
    }
  }

  // Módulo E: el resumen con IA usa el año más reciente con ratios calculados.
  const ratiosConValor = ratios.filter((r) => r.valor_calculado != null && r.anio_ratio)
  const anioResumen = ratiosConValor.length > 0 ? Math.max(...ratiosConValor.map((r) => Number(r.anio_ratio))) : 0
  const empresaResumen = ratiosConValor[0]?.empresa?.empresa_id ?? 0

  const recalcularTodos = async (forzar = false) => {
    setRecalculando(true)
    try {
      const { data } = await apiClient.post<{ calculados: number; omitidos: number; avisos: string[] }>('/ratios/recalcular', { forzar }, { timeout: 300_000 })
      setAvisosRecalculo(data.avisos)
      if (data.calculados || data.avisos.length) await fetchData(filtroEmpresa ?? '')
      if (data.avisos.length) Notifier.warning('Recálculo terminado con avisos. Revise el detalle.')
      else if (!data.calculados && data.omitidos) Notifier.success('Los indicadores ya están actualizados. No se repitieron los cálculos.')
      else Notifier.success(`${data.calculados} indicadores actualizados; ${data.omitidos} sin cambios.`)
    } catch (e) { Notifier.error(getErrorMessage(e, 'No se pudo completar el recálculo.')) }
    finally { setRecalculando(false) }
  }

  return (
    <div style={{ padding: '20px' }}>
      <SubMenu links={sectoresSubMenuLinks} />
      <PeriodosPreliminares />

      <div className={recalculoStyles.toolbar}>
        <ActualizarIndicadores disabled={loading || !empresa} cargando={recalculando} onActualizar={forzar => void recalcularTodos(forzar)} />
        <BotonResumenIA
          key={JSON.stringify(ratios)}
          tipo="ratios"
          datos={{ empresaId: empresaResumen, anio: anioResumen }}
          disabled={loading || anioResumen === 0}
          etiqueta={anioResumen ? `Resumen con IA (${anioResumen})` : 'Resumen con IA'}
        />
      </div>
      {avisosRecalculo.length > 0 && <details role="status"><summary>Avisos del último recálculo ({avisosRecalculo.length})</summary><ul>{avisosRecalculo.map((a, i) => <li key={i}>{a}</li>)}</ul></details>}

      <div style={{ marginTop: '1rem' }}>
        {loading ? (
          <p>Cargando ratios...</p>
        ) : (
          <Tabla
            titulo="Gestión de Ratios"
            textoBotonNuevo="Nuevo Ratio"
            columnas={columnas}
            datos={ratios}
            onNuevoClick={handleNuevoRatio}
            enEditar={handleEditar}
            enEliminar={handleEliminar}
            enVer={handleVer}
            enCalcular={handleCalcular}
          />
        )}
      </div>

      <RatioFormModal
        show={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        initialData={editingRatio}
        categorias={categorias}
        parametros={parametros}
        empresas={empresas}
      />

      <RatioDetailsModal
        show={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        ratio={selectedRatioDetails}
      />
    </div>
  )
}

export default Ratio
