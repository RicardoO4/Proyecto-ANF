'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import SubMenu from '@/components/shared/SubMenu'
import EmpresaFija from '@/components/shared/EmpresaFija'
import { inventarioSubMenuLinks } from '@/config/menuConfig'
import { useEmpresaPrincipal } from '@/hooks/useEmpresaPrincipal'
import { inventarioService, type ParametroInventario } from '@/services/inventarioService'
import { getErrorMessage } from '@/services/api'
import { Notifier } from '@/utils/Notifier'
import styles from '@/styles/inventario/Inventario.module.css'
import buttonStyles from '@/styles/shared/Button.module.css'

interface FormValues {
  costoPedido: number
  tasaMantenimiento: number
  leadTimeDias: number
  diasAnio: number
  corteA: number
  corteB: number
}

const VALORES_INICIALES: FormValues = {
  costoPedido: 0,
  tasaMantenimiento: 0,
  leadTimeDias: 0,
  diasAnio: 365,
  corteA: 0.8,
  corteB: 0.95,
}

export const ParametrosForm = () => {
  const [empresaId, setEmpresaId] = useState<number | null>(null)
  const { empresa, error: errorEmpresa } = useEmpresaPrincipal((e) => setEmpresaId(e.empresaId))
  const [loading, setLoading] = useState(true)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: VALORES_INICIALES })

  useEffect(() => {
    if (empresaId == null) return
    let activo = true
    inventarioService
      .getParametros(empresaId)
      .then((parametros: ParametroInventario | null) => {
        if (!activo) return
        reset(
          parametros
            ? {
                costoPedido: parametros.costoPedido,
                tasaMantenimiento: parametros.tasaMantenimiento,
                leadTimeDias: parametros.leadTimeDias,
                diasAnio: parametros.diasAnio,
                corteA: parametros.corteA,
                corteB: parametros.corteB,
              }
            : VALORES_INICIALES,
        )
      })
      .catch((err: unknown) => {
        Notifier.error(getErrorMessage(err, 'No se pudieron cargar los parámetros.'))
      })
      .finally(() => {
        if (activo) setLoading(false)
      })
    return () => {
      activo = false
    }
  }, [empresaId, reset])

  const onSubmit = async (values: FormValues) => {
    if (empresaId == null) return
    const toastId = Notifier.loading('Guardando parámetros...')
    try {
      await inventarioService.saveParametros({
        empresaId,
        costoPedido: Number(values.costoPedido),
        tasaMantenimiento: Number(values.tasaMantenimiento),
        leadTimeDias: Number(values.leadTimeDias),
        diasAnio: Number(values.diasAnio),
        corteA: Number(values.corteA),
        corteB: Number(values.corteB),
      })
      Notifier.success('Parámetros guardados.')
    } catch (err) {
      Notifier.error(getErrorMessage(err, 'No se pudieron guardar los parámetros.'))
    } finally {
      Notifier.dismiss(String(toastId))
    }
  }

  return (
    <div className={styles.page}>
      <SubMenu links={inventarioSubMenuLinks} />
      <div className={styles.empresa}>
        <label htmlFor="empresa-parametros">Empresa</label>
        <EmpresaFija
          id="empresa-parametros"
          empresa={empresa}
          error={errorEmpresa}
          className="form-select"
        />
      </div>
      {loading ? (
        <p>Cargando parámetros...</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} style={{ maxWidth: 720 }}>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Costo de pedido (S, $)</label>
              <input
                type="number"
                step="0.01"
                className={`form-control ${errors.costoPedido ? 'is-invalid' : ''}`}
                {...register('costoPedido', {
                  required: true,
                  valueAsNumber: true,
                  min: { value: 0, message: 'No puede ser negativo' },
                })}
              />
              {errors.costoPedido && (
                <div className="invalid-feedback">{errors.costoPedido.message as string}</div>
              )}
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Tasa de mantenimiento (h)</label>
              <input
                type="number"
                step="0.0001"
                className={`form-control ${errors.tasaMantenimiento ? 'is-invalid' : ''}`}
                {...register('tasaMantenimiento', {
                  required: true,
                  valueAsNumber: true,
                  min: { value: 0, message: 'No puede ser negativo' },
                })}
              />
              {errors.tasaMantenimiento && (
                <div className="invalid-feedback">{errors.tasaMantenimiento.message as string}</div>
              )}
            </div>
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Lead time (días)</label>
              <input
                type="number"
                step="1"
                className={`form-control ${errors.leadTimeDias ? 'is-invalid' : ''}`}
                {...register('leadTimeDias', {
                  required: true,
                  valueAsNumber: true,
                  min: { value: 0, message: 'No puede ser negativo' },
                })}
              />
              {errors.leadTimeDias && (
                <div className="invalid-feedback">{errors.leadTimeDias.message as string}</div>
              )}
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Días por año</label>
              <input
                type="number"
                step="1"
                className={`form-control ${errors.diasAnio ? 'is-invalid' : ''}`}
                {...register('diasAnio', {
                  required: true,
                  valueAsNumber: true,
                  min: { value: 1, message: 'Debe ser positivo' },
                })}
              />
              {errors.diasAnio && (
                <div className="invalid-feedback">{errors.diasAnio.message as string}</div>
              )}
            </div>
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label className="form-label">Corte A (acumulado)</label>
              <input
                type="number"
                step="0.01"
                className={`form-control ${errors.corteA ? 'is-invalid' : ''}`}
                {...register('corteA', { required: true, valueAsNumber: true })}
              />
              {errors.corteA && (
                <div className="invalid-feedback">{errors.corteA.message as string}</div>
              )}
            </div>
            <div className="col-md-6 mb-3">
              <label className="form-label">Corte B (acumulado)</label>
              <input
                type="number"
                step="0.01"
                className={`form-control ${errors.corteB ? 'is-invalid' : ''}`}
                {...register('corteB', { required: true, valueAsNumber: true })}
              />
              {errors.corteB && (
                <div className="invalid-feedback">{errors.corteB.message as string}</div>
              )}
            </div>
          </div>
          <button type="submit" className={buttonStyles.btnPrimary}>
            Guardar Parámetros
          </button>
        </form>
      )}
    </div>
  )
}

export default ParametrosForm
