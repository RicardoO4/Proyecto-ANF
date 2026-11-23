'use client'
import {useState} from 'react'
import {resumenContable} from '@/lib/contabilidad'
import {useContabilidad,dinero,estadoDelReporte} from './ContabilidadContext'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import ExportarContabilidad from './ExportarContabilidad'

export default function EstadosContables(){
  const {base,periodo}=useContabilidad()
  const [reporte,setReporte]=useState('BG')
  if(!base||!periodo)return <p>Selecciona un ejercicio para consultar sus estados.</p>
  const resumen=resumenContable(base)
  const filas=reporte==='BG'?base.estados?.balance:base.estados?.resultados
  return <section>
    <div className={styles.toolbar}><p className={styles.muted}>{estadoDelReporte(periodo)} · {periodo.anio}</p><ExportarContabilidad/></div>
    <p className={styles.notice}>{periodo.origen==='HISTORICO'?'Se conservan el balance general y el estado de resultados importados.':periodo.estado==='CERRADO'?'Esta es la información del ejercicio cerrado.':'Vista provisional: incluye las partidas contabilizadas. Completa las operaciones y ajustes antes de cerrar el ejercicio.'}</p>
    <nav className={styles.tabs} aria-label="Elegir estado financiero">{[['BG','Balance General'],['ER','Estado de Resultados'],['EC','Estado de Capital']].map(([id,label])=><button key={id} className={reporte===id?styles.activeTab:''} aria-pressed={reporte===id} onClick={()=>setReporte(id)}>{label}</button>)}</nav>
    {reporte==='EC'?<div className={styles.panel}><h3>Estado de Capital / cambios en el patrimonio</h3>{periodo.origen==='HISTORICO'?<p>No hay movimientos históricos disponibles para elaborar este estado. Patrimonio al cierre: {dinero(resumen.patrimonio)}.</p>:<dl className={styles.capital}><dt>Patrimonio inicial</dt><dd>{dinero(resumen.inicial)}</dd><dt>Aportes, retiros y otros movimientos netos</dt><dd>{dinero(resumen.movimientos)}</dd><dt>Resultado del ejercicio</dt><dd>{dinero(resumen.utilidad)}</dd><dt>Patrimonio final</dt><dd>{dinero(resumen.patrimonioFinal)}</dd></dl>}</div>:<div className={styles.panel}><h3>{reporte==='BG'?'Balance General':'Estado de Resultados'} · {periodo.anio}</h3><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Cuenta</th><th>Saldo</th></tr></thead><tbody>{filas?.map(l=><tr key={l.cuentaId}><td>{l.codigo} · {l.nombre}</td><td>{dinero(l.saldo)}</td></tr>)}</tbody><tfoot>{reporte==='BG'?<><tr><th>Total Activo</th><td>{dinero(resumen.activos)}</td></tr><tr><th>Total Pasivo</th><td>{dinero(resumen.pasivos)}</td></tr><tr><th>Total Patrimonio</th><td>{dinero(resumen.patrimonio)}</td></tr></>:<tr><th>Resultado del ejercicio</th><td>{dinero(resumen.utilidad)}</td></tr>}</tfoot></table></div></div>}
  </section>
}
