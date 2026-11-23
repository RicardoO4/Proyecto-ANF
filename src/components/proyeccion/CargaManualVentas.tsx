'use client'

import React, { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { FaPlus, FaTrash } from 'react-icons/fa'
import { Notifier } from '@/utils/Notifier'
import EmpresaFija from '@/components/shared/EmpresaFija'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import { ventaHistoricaService } from '@/services/ventaHistoricaService'
import buttonStyles from '@/styles/shared/Button.module.css'
import viewStyles from '@/styles/shared/View.module.css'
import { fechaFinDeMes } from '@/lib/ventasMensuales'

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
  onGuardado?: () => void
}

export const CargaManualVentas = ({ onGuardado }: CargaManualVentasProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [anioCarga, setAnioCarga] = useState(new Date().getFullYear())
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ManualFormValues>({
    defaultValues: { empresaId: '', ventas: [{ fechaVenta: '', montoVenta: '', observacion: '' }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'ventas' })

  const { empresa, error: errorEmpresa } = useEmpresaPrincipal((e) =>
    setValue('empresaId', String(e.empresaId)),
  )

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
        const fechaVenta = fechaFinDeMes(`${year}-${month}`)

        return {
          fechaVenta,
          montoVenta: Number(v.montoVenta),
          observacion:
            v.observacion ||
            `Ventas ${v.fechaVenta}`,
        }
      }),
    }
    const toastId = Notifier.loading('Guardando registros...')
    try {
      await ventaHistoricaService.createVentasManual(payload)
      Notifier.dismiss(String(toastId))
      Notifier.success('Ventas guardadas correctamente.')
      onGuardado?.()
      reset({
        empresaId: getValues('empresaId'),
        ventas: [{ fechaVenta: '', montoVenta: '', observacion: '' }],
      })
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
      <div className="d-flex gap-2 align-items-end mb-3">
        <label>Año de los datos<input className="form-control" type="number" min={1900} max={2200} value={anioCarga} onChange={e => setAnioCarga(Number(e.target.value))} /></label>
        <button type="button" className={buttonStyles.btnSecondary} disabled={isLoading || !Number.isInteger(anioCarga) || anioCarga < 1900 || anioCarga > 2200} onClick={() => reset({ empresaId: getValues('empresaId'), ventas: Array.from({ length: 12 }, (_, i) => ({ fechaVenta: `${anioCarga}-${String(i + 1).padStart(2, '0')}`, montoVenta: '', observacion: '' })) })}>Preparar doce meses</button>
      </div>
      <p>Ingrese el total real de cada mes. El total anual del balance no sustituye estos importes. Preparar los meses reemplaza las filas sin guardar; no modifica registros guardados.</p>
      {/* Selector de Empresa */}
      <div className="mb-4">
        <label htmlFor="empresaId" className="form-label fw-bold">Empresa</label>
        <input type="hidden" {...register('empresaId', { required: 'No se pudo cargar la empresa principal' })} />
        <EmpresaFija
          id="empresaId"
          className={`form-select ${errors.empresaId ? 'is-invalid' : ''}`}
          empresa={empresa}
          error={errorEmpresa}
        />
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
                    min={0}
                    className="form-control"
                    {...register(`ventas.${index}.montoVenta` as const, {
                      required: true,
                      min: 0,
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
