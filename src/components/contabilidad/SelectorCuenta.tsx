'use client'

import { useState } from 'react'
import type { CuentaContable } from '@/lib/contabilidad'
import { buscarCuentas } from '@/lib/buscarCuentas'
import styles from '@/styles/contabilidad/Contabilidad.module.css'

interface Props {
  cuentas: CuentaContable[]
  cuentaId: number
  linea?: number
  disabled?: boolean
  required?: boolean
  onChange: (cuentaId: string) => void
}

export default function SelectorCuenta({ cuentas, cuentaId, linea, disabled=false, required=true, onChange }: Props) {
  const [busqueda, setBusqueda] = useState('')
  const resultados = buscarCuentas(cuentas, busqueda)
  const seleccionada = cuentas.find(cuenta => cuenta.id === cuentaId)
  const mantenerSeleccion = seleccionada && !resultados.some(cuenta => cuenta.id === cuentaId)

  return <div className={styles.accountSelector}>
    <input
      type="search"
      className="form-control"
      aria-label={linea ? `Buscar cuenta de línea ${linea}` : 'Buscar cuenta del mayor'}
      placeholder="Buscar código o nombre…"
      autoComplete="off"
      value={busqueda}
      disabled={disabled}
      onChange={event => setBusqueda(event.target.value)}
      onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
    />
    <select
      aria-label={linea ? `Cuenta de línea ${linea}` : 'Cuenta del mayor'}
      className="form-select"
      required={required}
      disabled={disabled}
      value={cuentaId || ''}
      onChange={event => onChange(event.target.value)}
    >
      <option value="">Seleccione cuenta</option>
      {mantenerSeleccion && <option value={seleccionada.id}>{seleccionada.codigo} · {seleccionada.nombre} (seleccionada)</option>}
      {resultados.map(cuenta => <option key={cuenta.id} value={cuenta.id}>{cuenta.codigo} · {cuenta.nombre}</option>)}
    </select>
    {resultados.length === 0 && <small role="status" className={styles.accountSearchStatus}>No hay cuentas que coincidan con la búsqueda.</small>}
  </div>
}
