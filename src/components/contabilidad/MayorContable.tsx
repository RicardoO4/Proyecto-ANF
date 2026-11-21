'use client'
import {useState} from 'react'
import {useContabilidad,dinero} from './ContabilidadContext'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import {mayorContable} from '@/lib/contabilidad'
export default function MayorContable(){
 const {base,periodo}=useContabilidad()
 const [cuentaId,setCuentaId]=useState(''),[desde,setDesde]=useState(''),[hasta,setHasta]=useState('')
 const mayor=base?mayorContable(base.partidas,Number(cuentaId)):[]
 if(!base||!periodo)return <p>Selecciona un ejercicio para consultar el mayor.</p>
 return (<section><h3>Libro mayor</h3>{periodo.origen==='HISTORICO'?<p>El histórico solo contiene saldos al cierre; no existe detalle de fechas, cobros o pagos.</p>:<><div className={styles.toolbar}><label>Cuenta<select className="form-select" value={cuentaId} onChange={e=>setCuentaId(e.target.value)}><option value="">Seleccione cuenta</option>{base.cuentas.map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}</select></label><label>Desde<input className="form-control" type="date" value={desde} onChange={e=>setDesde(e.target.value)} /></label><label>Hasta<input className="form-control" type="date" value={hasta} onChange={e=>setHasta(e.target.value)} /></label></div><p className={styles.muted}>Incluye ajustes, correcciones y partidas de cierre. El saldo incorpora movimientos anteriores al filtro de fechas.</p><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Fecha / partida</th><th>Concepto</th><th>Tipo</th><th>Debe</th><th>Haber</th><th>Saldo (Debe − Haber)</th></tr></thead><tbody>{mayor.filter(l=>(!desde||l.fecha>=desde)&&(!hasta||l.fecha<=hasta)).map((l,i)=><tr key={i}><td>{l.fecha} / #{l.partida}</td><td>{l.concepto}</td><td>{l.tipo}</td><td>{dinero(l.debe)}</td><td>{dinero(l.haber)}</td><td>{dinero(l.saldo)}</td></tr>)}</tbody></table></div></>}</section>)
}

