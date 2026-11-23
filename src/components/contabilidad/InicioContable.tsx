'use client'
import Link from 'next/link'
import {resumenContable} from '@/lib/contabilidad'
import {useContabilidad,dinero} from './ContabilidadContext'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import views from '@/styles/shared/View.module.css'
import buttons from '@/styles/shared/Button.module.css'

export default function InicioContable(){
  const {base,periodo}=useContabilidad()
  const borradores=base?.partidas.filter(p=>p.estado==='BORRADOR').length??0
  const resumen=base?resumenContable(base):null
  const pasos=[
    ['01','Preparar el ejercicio','Abre el año desde el cierre anterior. Los históricos ya cargados se conservan.','/contabilidad/ejercicios'],
    ['02','Registrar transacciones','Prepara y contabiliza las operaciones diarias.','/contabilidad/transacciones'],
    ['03','Revisar y ajustar','Comprueba los saldos y registra los ajustes del período.','/contabilidad/ajustes'],
    ['04','Publicar y cerrar','Revisa los estados y entrega una versión al análisis financiero.','/contabilidad/cierre'],
  ]
  const siguiente=!periodo||periodo.origen==='HISTORICO'?['Preparar el siguiente ejercicio','/contabilidad/ejercicios']:borradores?['Revisar borradores pendientes','/contabilidad/transacciones']:periodo.estado==='CERRADO'?['Consultar estados finales','/contabilidad/estados']:['Registrar una transacción','/contabilidad/transacciones']
  return <div className={views.viewContainer}>
    <header className={views.viewHeader}><div><p className={styles.eyebrow}>TU ESPACIO DE TRABAJO</p><h1 className={views.viewTitle}>Inicio contable</h1><p className={styles.muted}>Registra operaciones y prepara los estados para el análisis financiero.</p></div><Link className={buttons.btnPrimary} href={siguiente[1]}>{siguiente[0]} →</Link></header>
    <div className={styles.overviewCards}>
      <div className={styles.metric}><span>Ejercicio seleccionado</span><strong>{periodo?.anio??'Sin ejercicio'}</strong><small>{periodo?.origen==='HISTORICO'?'Histórico de consulta':periodo?.estado??'Prepara la apertura'}</small></div>
      <div className={styles.metric}><span>Borradores pendientes</span><strong>{borradores}</strong><small>Todavía no afectan los saldos</small></div>
      <div className={styles.metric}><span>Resultado del ejercicio</span><strong>{dinero(resumen?.utilidad??0)}</strong><small>{periodo?.estado==='CERRADO'?'Ejercicio cerrado':'Vista provisional'}</small></div>
    </div>
    <h2 className={styles.sectionTitle}>Cómo avanzar</h2><div className={styles.workflowCards}>{pasos.map(([n,titulo,detalle,to])=><Link href={to} className={styles.workflowCard} key={n}><span className={styles.stepNumber}>{n}</span><h3>{titulo}</h3><p>{detalle}</p><span>Ir a esta etapa →</span></Link>)}</div>
    {periodo?.origen==='HISTORICO'&&<p className={styles.notice}>El balance general y el estado de resultados de este año son históricos. Sus saldos permiten abrir el siguiente ejercicio.</p>}
    {borradores>0&&<p className={styles.notice}>Tienes {borradores} borrador(es). Antes de publicar, debes contabilizarlos o descartarlos.</p>}
  </div>
}
