'use client'

import { useState } from 'react'
import { useContabilidad, dinero } from './ContabilidadContext'
import { buscarCuentas } from '@/lib/buscarCuentas'
import { centavos, type SaldoContable } from '@/lib/contabilidad'
import styles from '@/styles/contabilidad/Contabilidad.module.css'

const total = (filas: SaldoContable[], deudor: boolean) => filas.reduce((suma, fila) => suma + Math.max(centavos(fila.saldo) * (deudor ? 1 : -1), 0), 0) / 100

export default function ComprobacionContable() {
  const { base, periodo } = useContabilidad()
  const [busqueda, setBusqueda] = useState('')
  if (!base || !periodo) return <p>Selecciona un ejercicio para consultar la comprobación.</p>
  const filas = buscarCuentas(base.saldos, busqueda)

  return <section>
    <h3>Balance de comprobación {periodo.origen === 'HISTORICO' ? 'histórico' : 'ajustado'}</h3>
    <p className={styles.muted}>Los saldos positivos son deudores; los negativos, acreedores. La vista ajustada muestra los saldos anteriores a las partidas de cierre.</p>
    <div className={styles.toolbar}><label>Buscar cuenta<input type="search" className="form-control" placeholder="Código o nombre…" value={busqueda} onChange={event => setBusqueda(event.target.value)} /></label></div>
    <p className={styles.muted} role="status">Mostrando {filas.length} de {base.saldos.length} cuentas.</p>
    <div className={styles.scroll}><table className={styles.table}>
      <thead><tr><th>Cuenta</th><th>Sin ajustes</th><th>Ajustes (Debe − Haber)</th><th>Saldo deudor</th><th>Saldo acreedor</th></tr></thead>
      <tbody>{filas.map(linea => <tr key={`${linea.cuenta_id}-${linea.codigo}`}>
        <td>{linea.codigo} · {linea.nombre}</td><td>{dinero(linea.sin_ajustes)}</td><td>{dinero(linea.ajuste)}</td><td>{dinero(Math.max(linea.saldo, 0))}</td><td>{dinero(Math.max(-linea.saldo, 0))}</td>
      </tr>)}{filas.length === 0 && <tr><td colSpan={5}>No hay cuentas que coincidan con la búsqueda.</td></tr>}</tbody>
      <tfoot>
        {busqueda.trim() && <tr><th colSpan={3}>Subtotal de cuentas visibles</th><td>{dinero(total(filas, true))}</td><td>{dinero(total(filas, false))}</td></tr>}
        <tr><th colSpan={3}>Total del ejercicio</th><td>{dinero(total(base.saldos, true))}</td><td>{dinero(total(base.saldos, false))}</td></tr>
      </tfoot>
    </table></div>
  </section>
}
