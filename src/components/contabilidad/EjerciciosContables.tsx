'use client'
import {useState,useEffect} from 'react'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {apiClient,getErrorMessage} from '@/services/api'
import type {BaseContable} from '@/lib/contabilidad'
import {useContabilidad,dinero} from './ContabilidadContext'
import PartidaForm from './PartidaForm'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import buttons from '@/styles/shared/Button.module.css'

export default function EjerciciosContables(){
  const {base,periodo,busy,puede,actuar,seleccionar}=useContabilidad()
  const router=useRouter()
  const [crear,setCrear]=useState(false),[apertura,setApertura]=useState(false)
  const [anio,setAnio]=useState(''),[baseId,setBaseId]=useState(''),[cuenta,setCuenta]=useState('')
  const [saldoBase,setSaldoBase]=useState<number|null>(null),[consultando,setConsultando]=useState(false),[error,setError]=useState('')
  useEffect(()=>{
    if(!crear||!baseId)return
    const controller=new AbortController()
    void Promise.resolve().then(()=>{if(!controller.signal.aborted){setConsultando(true);setSaldoBase(null);setError('')}})
    apiClient.get<BaseContable>('/contabilidad',{params:{periodo:baseId},signal:controller.signal}).then(({data})=>{
      if(controller.signal.aborted)return
      const utilidad=data.estados?.utilidad??0
      setSaldoBase(utilidad)
      const codigo=utilidad<0?'3203.01':'3201.01'
      setCuenta(String(data.cuentas.find(c=>c.codigo===codigo&&c.activa&&c.imputable)?.id??''))
    }).catch(err=>{if(!controller.signal.aborted)setError(getErrorMessage(err))}).finally(()=>{if(!controller.signal.aborted)setConsultando(false)})
    return()=>controller.abort()
  },[crear,baseId])
  if(!base)return null
  const abierto=base.periodos.find(p=>p.origen==='CONTABILIDAD'&&p.estado!=='CERRADO')
  function preparar(){
    const cierre=base!.periodos.find(p=>p.estado==='CERRADO')
    setAnio(String(cierre?cierre.anio+1:new Date().getFullYear()));setBaseId(String(cierre?.id??''));setCrear(true)
  }
  return <section>
    <div className={styles.toolbar}><h2>Ejercicios anuales</h2>{puede(11)&&!abierto&&<button className={buttons.btnPrimary} disabled={busy} onClick={preparar}>Abrir nuevo ejercicio</button>}</div>
    {abierto&&<p className={styles.notice}>El ejercicio {abierto.anio} está {abierto.estado==='REVISION'?'en revisión':'abierto'}. Continúa sus operaciones antes de abrir el siguiente.</p>}
    <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Año</th><th>Origen</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{base.periodos.map(p=><tr key={p.id}><td>{p.anio}</td><td>{p.origen==='HISTORICO'?'Histórico importado':'Contabilidad'}</td><td>{p.estado}</td><td><button className={buttons.btnSecondary} disabled={busy} onClick={()=>{seleccionar(p.id);router.push(p.estado==='CERRADO'?'/contabilidad/estados':'/contabilidad/transacciones')}}>Abrir ejercicio {p.anio}</button></td></tr>)}</tbody></table></div>
    {crear&&<form className={styles.panel} onSubmit={async e=>{
      e.preventDefault();setError('')
      try{await actuar('crear_periodo',{anio:Number(anio),base:baseId||null,cuentaAcumulados:cuenta||null});setCrear(false);router.push('/contabilidad/transacciones')}
      catch(err){setError((err as Error).message)}
    }}>
      <h3>Preparar apertura</h3><div className={styles.formGrid}>
        <label>Año<input className="form-control" type="number" min="1900" max="2200" required value={anio} onChange={e=>setAnio(e.target.value)}/></label>
        <label>Cierre anterior<select className="form-select" required={base.periodos.length>0} value={baseId} onChange={e=>setBaseId(e.target.value)}><option value="">Primer ejercicio · apertura manual</option>{base.periodos.filter(p=>p.estado==='CERRADO').map(p=><option key={p.id} value={p.id}>{p.anio}</option>)}</select></label>
      </div>
      {baseId&&<><p className={styles.notice}>{consultando?'Consultando el cierre anterior…':saldoBase===null?'No se pudo consultar el resultado del cierre.':<>Resultado anterior: <strong>{dinero(saldoBase)}</strong>. Se trasladará a {saldoBase<0?'déficit':'utilidades'} de ejercicios anteriores. Los ingresos y gastos del nuevo año comienzan en cero.</>}</p>
        <details className={styles.partida}><summary>Revisar cuenta de resultados acumulados</summary><label className={styles.fullLabel}>Cuenta destino<select className="form-select" required={saldoBase!==0} value={cuenta} onChange={e=>setCuenta(e.target.value)}><option value="">Seleccione acumulados</option>{base.cuentas.filter(c=>c.activa&&c.imputable&&(c.codigo.startsWith('3201.')||c.codigo.startsWith('3203.'))).map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}</select></label></details>
      </>}
      {!baseId&&<p>Después de crear el ejercicio, registra y contabiliza su apertura inicial.</p>}
      <div className={styles.toolbar}><button className={buttons.btnPrimary} disabled={busy||Boolean(baseId&&(consultando||saldoBase===null||(saldoBase!==0&&!cuenta)))}>Crear ejercicio y apertura</button><button type="button" className={buttons.btnSecondary} disabled={busy} onClick={()=>setCrear(false)}>Cancelar</button></div>
      {error&&<p className={styles.error} role="alert">{error}</p>}
    </form>}
    {periodo?.origen==='CONTABILIDAD'&&periodo.estado!=='CERRADO'&&!base.partidas.some(a=>a.tipo==='APERTURA')&&puede(9)&&<div className={styles.panel}><h3>Apertura inicial pendiente</h3><p>Este ejercicio se creó sin cierre anterior. Registra los activos, pasivos y patrimonio iniciales para comenzar.</p><button className={buttons.btnPrimary} onClick={()=>setApertura(true)}>Registrar apertura inicial</button></div>}
    {apertura&&periodo&&<PartidaForm tipoInicial="APERTURA" periodo={periodo} cuentas={base.cuentas} partida={null} busy={busy} onClose={()=>setApertura(false)} onSave={async datos=>{await actuar('guardar',datos);setApertura(false);router.push('/contabilidad/transacciones')}}/>}
    <details className={styles.partida}><summary>Incorporar estados anteriores que ya existen en ANF</summary><p>Guarda sus saldos como históricos de consulta. No crea transacciones ni modifica sus estados.</p>{puede(11)?<button className={buttons.btnSecondary} disabled={busy} onClick={()=>void actuar('importar').catch(()=>{})}>Incorporar histórico existente</button>:<p>Disponible para el contador y el administrador.</p>}</details>
    <p className={styles.muted}>Para consultar saldos utiliza <Link href="/contabilidad/libros">Libros contables</Link>. La apertura se genera una sola vez.</p>
  </section>
}
