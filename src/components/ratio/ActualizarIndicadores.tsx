'use client'

import { Dropdown } from 'react-bootstrap'
import { ArrowRepeat, ChevronDown } from 'react-bootstrap-icons'
import styles from '@/styles/ratio/ActualizarIndicadores.module.css'

interface Props {
  disabled: boolean
  cargando: boolean
  onActualizar: (forzar: boolean) => void
}

export default function ActualizarIndicadores({ disabled, cargando, onActualizar }: Props) {
  return <Dropdown className={styles.group}>
    <button type="button" className={styles.primary} disabled={disabled || cargando} onClick={() => onActualizar(false)}>
      <ArrowRepeat size={16} aria-hidden="true" />
      {cargando ? 'Actualizando indicadores…' : 'Actualizar indicadores'}
    </button>
    <Dropdown.Toggle className={styles.toggle} disabled={disabled || cargando} aria-label="Opciones de actualización de indicadores" title="Opciones de actualización">
      <ChevronDown size={14} aria-hidden="true" />
    </Dropdown.Toggle>
    <Dropdown.Menu align="end" className={styles.menu}>
      <Dropdown.Item as="button" className={styles.option} disabled={disabled || cargando} onClick={() => onActualizar(true)}>
        <ArrowRepeat size={18} aria-hidden="true" />
        <span><strong>Recalcular todos los años</strong><small>Repite los cálculos, incluidos los indicadores que ya están actualizados.</small></span>
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
}
