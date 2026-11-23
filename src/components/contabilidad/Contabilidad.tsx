'use client'
import Link from 'next/link'
import {useAuth} from '@/context/AuthContext'
import {useContabilidad} from './ContabilidadContext'
import InicioContable from './InicioContable'
import EjerciciosContables from './EjerciciosContables'
import PartidasContables from './PartidasContables'
import MayorContable from './MayorContable'
import ComprobacionContable from './ComprobacionContable'
import EstadosContables from './EstadosContables'
import CierreContable from './CierreContable'
import AuditoriaContable from './AuditoriaContable'
import CatalogoContable from './CatalogoContable'
import ExportarContabilidad from './ExportarContabilidad'
import views from '@/styles/shared/View.module.css'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import buttons from '@/styles/shared/Button.module.css'

const titulos={ejercicios:'Ejercicios',catalogo:'Catálogo de cuentas',transacciones:'Transacciones',libros:'Libros contables',diario:'Diario contable',mayor:'Libro mayor',comprobacion:'Balance de comprobación',ajustes:'Ajustes y revisión',estados:'Estados financieros',cierre:'Publicación y cierre',auditoria:'Auditoría'}
export type VistaContable='inicio'|keyof typeof titulos
export default function Contabilidad({vista='inicio'}:{vista?:VistaContable}){
  const {base,periodo,busy,puede,actuar,confirmar}=useContabilidad()
  const {user}=useAuth()
  if(vista==='inicio')return <InicioContable/>
  return <div className={views.viewContainer}>
    <header className={views.viewHeader}><div><p className={styles.eyebrow}>CONTABILIDAD{periodo?` · ${periodo.anio}`:''}</p><h1 className={views.viewTitle}>{titulos[vista]}</h1></div>{['diario','mayor','comprobacion'].includes(vista)&&<ExportarContabilidad/>}</header>
    {vista==='ejercicios'&&<EjerciciosContables/>}
    {vista==='catalogo'&&base&&<CatalogoContable cuentas={base.cuentas} puedeCrear={user?.rol==='ADMIN'} busy={busy} crear={async datos=>{await actuar('crear_cuenta',datos)}}/>}
    {vista==='transacciones'&&<><p className={styles.muted}>Registra una operación como borrador y contabilízala cuando esté revisada. Solo las partidas contabilizadas actualizan los saldos.</p><PartidasContables/></>}
    {vista==='libros'&&<div className={styles.workflowCards}>{[['diario','Diario contable','Consulta las partidas contabilizadas en orden de registro.'],['mayor','Libro mayor','Revisa cargos, abonos y saldo por cuenta.'],['comprobacion','Comprobación','Contrasta los saldos antes y después de los ajustes.']].map(([to,title,detail])=><Link key={to} href={'/contabilidad/libros/'+to} className={styles.workflowCard}><h2>{title}</h2><p>{detail}</p><span>Consultar →</span></Link>)}</div>}
    {vista==='diario'&&<PartidasContables modo="diario"/>}
    {vista==='mayor'&&<MayorContable/>}
    {vista==='comprobacion'&&<ComprobacionContable/>}
    {vista==='ajustes'&&<><p className={styles.notice}>Primero consulta la comprobación. Registra los ajustes que correspondan y revisa los estados antes de enviarlos al análisis o cerrar el ejercicio.</p><div className={styles.toolbar}><Link className={buttons.btnSecondary} href="/contabilidad/libros/comprobacion">Revisar comprobación</Link><Link className={buttons.btnSecondary} href="/contabilidad/estados">Consultar estados</Link>{periodo?.origen==='CONTABILIDAD'&&periodo.estado!=='CERRADO'&&puede(11)&&<button className={buttons.btnSecondary} disabled={busy} onClick={()=>void confirmar('revision',periodo.estado==='ABIERTO'?'¿Pasar a revisión y restringir operaciones ordinarias?':'¿Volver a ejercicio abierto?')}>{periodo.estado==='ABIERTO'?'Pasar a revisión':'Volver a abierto'}</button>}</div><PartidasContables modo="ajustes"/></>}
    {vista==='estados'&&<EstadosContables/>}
    {vista==='cierre'&&<CierreContable/>}
    {vista==='auditoria'&&<AuditoriaContable/>}
  </div>
}
