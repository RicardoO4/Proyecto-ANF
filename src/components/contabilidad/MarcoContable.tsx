'use client'
import type {ReactNode} from 'react'
import {useEmpresaPrincipal} from '@/hooks/useEmpresaPrincipal'
import {useAuth} from '@/context/AuthContext'
import {useContabilidad,estadoDelReporte} from './ContabilidadContext'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import buttons from '@/styles/shared/Button.module.css'

export default function MarcoContable({children}:{children:ReactNode}){
  const {empresa}=useEmpresaPrincipal(),{user}=useAuth()
  const {base,periodo,periodoId,seleccionar,actualizar,loading,busy,error,avisos}=useContabilidad()
  return <div>
    <div className={styles.workspaceBar}>
      <div><span className={styles.eyebrow}>ANF · ÁREA CONTABLE</span><p>{empresa?.nombreEmpresa??'Empresa principal'} <span className={styles.muted}>· {user?.userName}</span></p></div>
      <label className={styles.periodSelect}>Ejercicio<select className="form-select" value={periodoId??''} disabled={busy||loading} onChange={e=>seleccionar(Number(e.target.value))}><option value="" disabled>Seleccione ejercicio</option>{base?.periodos.map(p=><option key={p.id} value={p.id}>{p.anio} · {p.origen==='HISTORICO'?'Histórico':p.estado}</option>)}</select></label>
      <button className={buttons.btnSecondary} disabled={busy||loading} onClick={()=>void actualizar()}>Actualizar</button>
    </div>
    {periodo&&<div className={styles.reportStrip}><span>{estadoDelReporte(periodo)}</span><span>{periodo.origen==='HISTORICO'?'Saldos de origen conservados':periodo.version_publicada===null?'Aún no enviado al análisis':periodo.version_publicada===periodo.version?'ANF utiliza esta versión':'Hay cambios pendientes de enviar a ANF'}</span></div>}
    {error&&<p className={styles.error} role="alert">{error}</p>}{avisos.map((a,i)=><p key={i} className={styles.notice} role="status">{a}</p>)}
    {base?.estados?.error&&<p className={styles.error} role="alert">{base.estados.error}</p>}
    {loading?<p role="status">Cargando ejercicio contable…</p>:children}
  </div>
}
