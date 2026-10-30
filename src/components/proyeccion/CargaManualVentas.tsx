'use client'

import React, { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { FaPlus, FaTrash } from 'react-icons/fa'
import { Notifier } from '@/utils/Notifier'
import { empresaService } from '@/services/empresaService'
import { ventaHistoricaService } from '@/services/ventaHistoricaService'
import buttonStyles from '@/styles/shared/Button.module.css'
import viewStyles from '@/styles/shared/View.module.css'
import type { EmpresaResponseDTO } from '@/types'

interface VentaRow {
  fechaVenta: string
  montoVenta: string
  observacion: string
}

interface ManualFormValues {
  empresaId: string
  ventas: VentaRow[]
}

interface CargaManualVentasProps {
  ventas: string[]
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setVentas: (v: string[]) => void
}

export const CargaManualVentas = (_props: CargaManualVentasProps) => {
  const [empresas, setEmpresas] = useState<EmpresaResponseDTO[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManualFormValues>({
    defaultValues: { empresaId: '', ventas: [{ fechaVenta: '', montoVenta: '', observacion: '' }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'ventas' })

  useEffect(() => {
    empresaService
      .getEmpresas()
      .then(setEmpresas)
      .catch(() => Notifier.error('No se pudieron cargar las empresas.'))
  }, [])

  const onSubmit = async (data: ManualFormValues) => {
    setIsLoading(true)
    const fechas = data.ventas.map((v) => v.fechaVenta)
    const duplicadas = fechas.filter((f, i) => fechas.indexOf(f) !== i)
    if (duplicadas.length > 0) {
      Notifier.error('No puedes repetir meses en las ventas.')
      setIsLoading(false)
      return
    }
    const payload = {
      empresaId: parseInt(data.empresaId, 10),
      ventas: data.ventas.map((v) => {
        // Aseguramos formato YYYY-MM-DD (último día del mes)
        const [year, month] = v.fechaVenta.split('-')
        const fechaVenta = new Date(Number(year), Number(month), 0) // Día 0 del mes siguiente = último día del mes actual

        return {
          fechaVenta: fechaVenta.toISOString().split('T')[0], // "YYYY-MM-DD"
          montoVenta: parseFloat(v.montoVenta),
          observacion:
            v.observacion ||
            `Ventas ${fechaVenta.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`,
        }
      }),
    }
    const toastId = Notifier.loading('Guardando registros...')
    try {
      await ventaHistoricaService.createVentasManual(payload)
      Notifier.dismiss(String(toastId))
      Notifier.success('Ventas guardadas correctamente.')
      reset()
    } catch (error: unknown) {
      Notifier.dismiss(String(toastId))
      const err = error as { response?: { data?: { message?: string } } }
      Notifier.error(err.response?.data?.message || 'Error al guardar las ventas.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Selector de Empresa */}
      <div className="mb-4">
        <label htmlFor="empresaId" className="form-label fw-bold">Empresa</label>
        <select
          id="empresaId"
          className={`form-select ${errors.empresaId ? 'is-invalid' : ''}`}
          {...register('empresaId', { required: 'Debe seleccionar una empresa' })}
        >
          <option value="">-- Seleccione una Empresa --</option>
          {empresas.map((e) => (
            <option key={e.empresaId} value={e.empresaId}>
              {e.nombreEmpresa}
            </option>
          ))}
        </select>
        {errors.empresaId && <div className="invalid-feedback">{errors.empresaId.message}</div>}
      </div>

      {/* Tabla de Entradas Dinámicas */}
      <div className="table-responsive">
        <table className={viewStyles.table}>
          <thead>
            <tr>
              <th>Fecha de Venta</th>
              <th>Monto de Venta</th>
              <th>Observación (Opcional)</th>
              <th className="text-end">Acción</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id}>
                <td>
                  <input
                    type="month"
                    className="form-control"
                    {...register(`ventas.${index}.fechaVenta` as const, { required: true })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    {...register(`ventas.${index}.montoVenta` as const, {
                      required: true,
                      valueAsNumber: true,
                    })}
                  />
                </td>
                <td>
                  <input type="text" className="form-control" {...register(`ventas.${index}.observacion` as const)} />
                </td>
                <td className="text-end">
                  <button
                    type="button"
                    className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconDelete}`}
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Botones de Acción */}
      <div className="d-flex justify-content-between mt-4">
        <button
          type="button"
          className={buttonStyles.btnSecondary}
          onClick={() => append({ fechaVenta: '', montoVenta: '', observacion: '' })}
        >
          <FaPlus className="me-2" /> Añadir Fila
        </button>
        <button type="submit" className={buttonStyles.btnPrimary} disabled={isLoading}>
          {isLoading ? 'Guardando...' : 'Guardar Todas las Ventas'}
        </button>
      </div>
    </form>
  )
}

export default CargaManualVentas
