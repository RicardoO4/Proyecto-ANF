'use client'

import { useState } from 'react'
import { useContabilidad, dinero } from './ContabilidadContext'
import SelectorCuenta from './SelectorCuenta'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import { mayorContable } from '@/lib/contabilidad'

export default function MayorContable() {
  const { base, periodo } = useContabilidad()
  const [cuentaId, setCuentaId] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  if (!base || !periodo) return <p>Selecciona un ejercicio para consultar el mayor.</p>
  const mayor = mayorContable(base.partidas, Number(cuentaId))
  const movimientos = mayor.filter(linea => (!desde || linea.fecha >= desde) && (!hasta || linea.fecha <= hasta))

  return <section>
    <h3>Libro mayor</h3>
    {periodo.origen === 'HISTORICO' ? <p>El histórico solo contiene saldos al cierre; no existe detalle de fechas, cobros o pagos.</p> : <>
      <div className={styles.toolbar}>
        <div className={styles.accountField}><span>Cuenta</span><SelectorCuenta cuentas={base.cuentas} cuentaId={Number(cuentaId)} onChange={setCuentaId} required={false} /></div>
        <label>Desde<input className="form-control" type="date" value={desde} onChange={event => setDesde(event.target.value)} /></label>
        <label>Hasta<input className="form-control" type="date" value={hasta} onChange={event => setHasta(event.target.value)} /></label>
      </div>
      <p className={styles.muted}>Incluye ajustes, correcciones y partidas de cierre. El saldo incorpora movimientos anteriores al filtro de fechas.</p>
      <div className={styles.scroll}><table className={styles.table}>
        <thead><tr><th>Fecha / partida</th><th>Concepto</th><th>Tipo</th><th>Debe</th><th>Haber</th><th>Saldo (Debe − Haber)</th></tr></thead>
        <tbody>{movimientos.map((linea, index) => <tr key={index}>
          <td>{linea.fecha} / #{linea.partida}</td><td>{linea.concepto}</td><td>{linea.tipo}</td><td>{dinero(linea.debe)}</td><td>{dinero(linea.haber)}</td><td>{dinero(linea.saldo)}</td>
        </tr>)}{movimientos.length === 0 && <tr><td colSpan={6}>{cuentaId ? 'No hay movimientos para esta cuenta en las fechas seleccionadas.' : 'Busca y selecciona una cuenta para consultar sus movimientos.'}</td></tr>}</tbody>
      </table></div>
    </>}
  </section>
}
