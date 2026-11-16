'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { estadoFinancieroService, type EstadoFinancieroDetail } from '@/services/estadoFinancieroService'
import { Notifier } from '@/utils/Notifier'
import { ArrowLeftCircle } from 'react-bootstrap-icons'
import SubMenu from '@/components/shared/SubMenu'
import { estadosFinancierosSubMenuLinks } from '@/config/menuConfig'

import viewStyles from '@/styles/shared/View.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'
import localStyles from '@/styles/estadosfinancieros/DetalleEstadoFinanciero.module.css'
import type { LineaEstadoFinancieroResponseDTO } from '@/types'
import {
  ACTIVO_TOTAL,
  COSTO_VENTAS,
  GASTOS_OPERATIVOS,
  PASIVO_TOTAL,
  PATRIMONIO_TOTAL,
  REBAJAS_DEVOLUCIONES,
  TIPO_REPORTE,
  TOTAL_COSTOS_GASTOS,
  TOTAL_INGRESOS,
  VENTAS_BRUTAS,
} from '@/lib/accountCodes'

// Función para formatear números como moneda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

type ProcessedBalance = {
  type: 'Balance General'
  activos: LineaEstadoFinancieroResponseDTO[]
  pasivos: LineaEstadoFinancieroResponseDTO[]
  patrimonio: LineaEstadoFinancieroResponseDTO[]
  totalActivos: number
  totalPasivos: number
  totalPatrimonio: number
}

type ProcessedResultados = {
  type: 'Estado de Resultados'
  ingresosOperacion: LineaEstadoFinancieroResponseDTO[]
  costosOperacion: LineaEstadoFinancieroResponseDTO[]
  gastosOperacion: LineaEstadoFinancieroResponseDTO[]
  otrosIngresos: LineaEstadoFinancieroResponseDTO[]
  impuestoRenta: LineaEstadoFinancieroResponseDTO[]
  totalIngresosOp: number
  totalCostosOp: number
  totalGastosOp: number
  totalOtrosIngresos: number
  totalImpuesto: number
  utilidadAntesGastos: number
  utilidadOperacion: number
  utilidadAntesImpuesto: number
  utilidadNeta: number
}

const DetalleEstadoFinanciero = () => {
  const params = useParams()
  const id = params?.id as string
  const router = useRouter()
  const [reporte, setReporte] = useState<EstadoFinancieroDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchReporte = async () => {
      setIsLoading(true) // Asegura que muestre 'cargando' en cada nueva carga
      try {
        const data = await estadoFinancieroService.getEstadoFinancieroById(Number(id))
        setReporte(data)
      } catch (error) {
        Notifier.error('No se pudo cargar el detalle del reporte.')
      } finally {
        setIsLoading(false)
      }
    }
    fetchReporte()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // --- LÓGICA CONDICIONAL MEJORADA ---
  // Este hook ahora decide qué datos calcular basado en el tipo de reporte
  const processedData = useMemo<ProcessedBalance | ProcessedResultados | null>(() => {
    if (!reporte) return null

    const sumSaldos = (arr: LineaEstadoFinancieroResponseDTO[]) =>
      arr.reduce((sum, item) => sum + item.saldo, 0)

    if (reporte.tipoReporte === TIPO_REPORTE.RESULTADOS) {
      const con = (prefijos: string[]) =>
        reporte.lineas.filter((l) => prefijos.some((p) => l.codigoCuenta.startsWith(p)))
      const sin = (grupo: string, excluidos: string[]) =>
        reporte.lineas.filter(
          (l) => l.codigoCuenta.startsWith(grupo) && !excluidos.some((p) => l.codigoCuenta.startsWith(p)),
        )

      // Prefijos de accountCodes.ts (Módulo B). Las rebajas (5101.02) se
      // muestran con signo negativo porque restan de las ventas.
      const ingresosOperacion = con([VENTAS_BRUTAS, REBAJAS_DEVOLUCIONES]).map((l) =>
        l.codigoCuenta.startsWith(REBAJAS_DEVOLUCIONES) ? { ...l, saldo: -l.saldo } : l,
      )
      const costosOperacion = con([COSTO_VENTAS])
      const gastosOperacion = con(GASTOS_OPERATIVOS)
      const otrosIngresos = sin(TOTAL_INGRESOS, [VENTAS_BRUTAS, REBAJAS_DEVOLUCIONES])
      const impuestoRenta = sin(TOTAL_COSTOS_GASTOS, [COSTO_VENTAS, ...GASTOS_OPERATIVOS])

      const totalIngresosOp = sumSaldos(ingresosOperacion)
      const totalCostosOp = sumSaldos(costosOperacion)
      const totalGastosOp = sumSaldos(gastosOperacion)
      const totalOtrosIngresos = sumSaldos(otrosIngresos)
      const totalImpuesto = sumSaldos(impuestoRenta)

      const utilidadAntesGastos = totalIngresosOp - totalCostosOp
      const utilidadOperacion = utilidadAntesGastos - totalGastosOp
      const utilidadAntesImpuesto = utilidadOperacion + totalOtrosIngresos
      const utilidadNeta = utilidadAntesImpuesto - totalImpuesto

      // 4. Devolvemos el objeto para la UI (esta parte no cambia)
      return {
        type: 'Estado de Resultados',
        ingresosOperacion,
        costosOperacion,
        gastosOperacion,
        otrosIngresos,
        impuestoRenta,
        totalIngresosOp,
        totalCostosOp,
        totalGastosOp,
        totalOtrosIngresos,
        totalImpuesto,
        utilidadAntesGastos,
        utilidadOperacion,
        utilidadAntesImpuesto,
        utilidadNeta,
      }
    }

    const activos = reporte.lineas.filter((l) => l.codigoCuenta.startsWith(ACTIVO_TOTAL))
    const pasivos = reporte.lineas.filter((l) => l.codigoCuenta.startsWith(PASIVO_TOTAL))
    const patrimonio = reporte.lineas.filter((l) => l.codigoCuenta.startsWith(PATRIMONIO_TOTAL))
    const totalActivos = sumSaldos(activos)
    const totalPasivos = sumSaldos(pasivos)
    const totalPatrimonio = sumSaldos(patrimonio)
    return {
      type: 'Balance General',
      activos,
      pasivos,
      patrimonio,
      totalActivos,
      totalPasivos,
      totalPatrimonio,
    }
  }, [reporte])

  if (isLoading) return <p>Cargando detalle del reporte...</p>
  if (!reporte || !processedData) return <p>No se encontró o no se pudo procesar el reporte.</p>

  // Función de ayuda para renderizar una sección (reutilizable)
  const renderSection = (
    title: string,
    items: LineaEstadoFinancieroResponseDTO[],
    total: number,
  ) => (
    <section className={localStyles.section}>
      <h4 className={localStyles.sectionTitle}>{title}</h4>
      <table className={localStyles.detailTable}>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={localStyles.tableRow}>
              <td>{item.codigoCuenta} - {item.nombreCuenta}</td>
              <td className={localStyles.numberCell}>{formatCurrency(item.saldo)}</td>
            </tr>
          ))}
          <tr className={localStyles.subtotalRow}>
            <td>Total {title}</td>
            <td className={localStyles.numberCell}>{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )

  return (
    <>
      <SubMenu links={estadosFinancierosSubMenuLinks} />
      <div className={viewStyles.viewContainer}>
        <button
          className={`${buttonStyles.btnSecondary} mb-4`}
          onClick={() => router.push('/estados-financieros/historial')}
        >
          <ArrowLeftCircle className="me-2" />
          Volver al Historial
        </button>

        <div className={localStyles.reportContainer}>
          <header className={localStyles.reportHeader}>
            <h2>{reporte.nombreEmpresa}</h2>
            <h3>{reporte.tipoReporte.replace('_', ' ')} - {reporte.anio}</h3>
          </header>

          {/* --- RENDERIZADO CONDICIONAL --- */}
          {processedData.type === 'Balance General' && (
            <>
              {renderSection('Activos', processedData.activos, processedData.totalActivos)}
              {renderSection('Pasivos', processedData.pasivos, processedData.totalPasivos)}
              {renderSection('Patrimonio', processedData.patrimonio, processedData.totalPatrimonio)}

              <table className={localStyles.detailTable}>
                <tbody>
                  <tr className={localStyles.grandTotalRow}>
                    <td>Total Pasivo y Patrimonio</td>
                    <td className={localStyles.numberCell}>
                      {formatCurrency(processedData.totalPasivos + processedData.totalPatrimonio)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          {processedData.type === 'Estado de Resultados' && (
            <>
              {renderSection('Ingresos de Operación', processedData.ingresosOperacion, processedData.totalIngresosOp)}
              {renderSection('Costos de Operación', processedData.costosOperacion, processedData.totalCostosOp)}

              <table className={localStyles.detailTable}>
                <tbody>
                  <tr className={localStyles.subtotalRow} style={{ fontWeight: 'bold' }}>
                    <td>Utilidad antes de gastos</td>
                    <td className={localStyles.numberCell}>{formatCurrency(processedData.utilidadAntesGastos)}</td>
                  </tr>
                </tbody>
              </table>

              {renderSection('Gastos de Operación', processedData.gastosOperacion, processedData.totalGastosOp)}

              <table className={localStyles.detailTable}>
                <tbody>
                  <tr className={localStyles.subtotalRow} style={{ fontWeight: 'bold' }}>
                    <td>Utilidad de operación</td>
                    <td className={localStyles.numberCell}>{formatCurrency(processedData.utilidadOperacion)}</td>
                  </tr>
                </tbody>
              </table>

              {renderSection('Otros Ingresos', processedData.otrosIngresos, processedData.totalOtrosIngresos)}
              {renderSection('Gastos financieros, otros gastos e impuestos', processedData.impuestoRenta, processedData.totalImpuesto)}

              <table className={localStyles.detailTable}>
                <tbody>
                  <tr className={localStyles.grandTotalRow}>
                    <td>Utilidad Neta</td>
                    <td className={localStyles.numberCell}>{formatCurrency(processedData.utilidadNeta)}</td>
                  </tr>
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default DetalleEstadoFinanciero
