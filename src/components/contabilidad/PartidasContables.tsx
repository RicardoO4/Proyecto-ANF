'use client'
import {useState} from 'react'
import {useContabilidad,dinero} from './ContabilidadContext'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import buttons from '@/styles/shared/Button.module.css'
import Link from 'next/link'
import PartidaForm from './PartidaForm'
import type {PartidaContable} from '@/lib/contabilidad'
export default function PartidasContables({modo='transacciones'}:{modo?:'transacciones'|'ajustes'|'diario'}){
 const {base:datos,periodo,busy,puede,actuar,confirmar}=useContabilidad()
 const [form,setForm]=useState<{partida:PartidaContable|null}|null>(null)
 const [corregir,setCorregir]=useState<PartidaContable|null>(null)
 const [motivo,setMotivo]=useState(''),[fechaCorreccion,setFechaCorreccion]=useState('')
 if(!datos||!periodo)return <p>Selecciona o <Link href='/contabilidad/ejercicios'>abre un ejercicio</Link> para registrar movimientos.</p>
 const base={...datos,partidas:datos.partidas.filter(a=>modo==='diario'?a.estado==='CONTABILIZADO':(modo==='ajustes'?(a.tipo==='AJUSTE'||datos.partidas.some(original=>original.id===a.reversa_de&&original.tipo==='AJUSTE')):!['AJUSTE','CIERRE','REAPERTURA'].includes(a.tipo)))}
 const editable=modo!=='diario'&&periodo.origen==='CONTABILIDAD'&&periodo.estado!=='CERRADO'
 return <><section><div className={styles.toolbar}><h3>{modo==='ajustes'?'Partidas de ajuste':modo==='diario'?'Diario contable':'Transacciones del ejercicio'}</h3>{editable&&puede(9)&&<button className={buttons.btnPrimary} disabled={busy} onClick={()=>setForm({partida:null})}>Nueva partida</button>}</div>
        {base.partidas.length===0?<p className={styles.muted}>{periodo.origen==='HISTORICO'?'Consulta los saldos importados en Comprobación.':'Aún no hay partidas. Registre la apertura si el ejercicio comenzó sin cierre base.'}</p>:base.partidas.map(a=><details key={a.id} className={styles.partida}><summary><strong>#{a.numero} · {a.fecha}</strong><span>{a.descripcion}</span><span className={styles.badge}>{a.tipo} · {a.estado}</span></summary><p className={styles.muted}>Responsable: {a.autor}{a.reversa_de?` · Revierte la partida con ID ${a.reversa_de}`:''}</p><div className={styles.scroll}><table className={styles.table}><thead><tr><th>Cuenta</th><th>Debe</th><th>Haber</th></tr></thead><tbody>{a.lineas.map((l,i)=><tr key={l.id??i}><td>{l.codigo} · {l.nombre}</td><td>{dinero(l.debe)}</td><td>{dinero(l.haber)}</td></tr>)}</tbody></table></div><div className={styles.toolbar}>
          {editable&&a.estado==='BORRADOR'&&<>{puede(9)&&<><button className={buttons.btnSecondary} disabled={busy} onClick={()=>setForm({partida:a})}>Editar borrador</button><button className={buttons.btnSecondary} disabled={busy} onClick={()=>void confirmar('descartar','¿Descartar este borrador?',{id:a.id})}>Descartar</button></>}{puede(10)&&<button className={buttons.btnPrimary} disabled={busy} onClick={()=>void confirmar('contabilizar','¿Contabilizar esta partida?',{id:a.id})}>Contabilizar</button>}</>}
          {editable&&puede(10)&&a.estado==='CONTABILIZADO'&&!['APERTURA','CIERRE','REAPERTURA'].includes(a.tipo)&&!base.partidas.some(r=>r.reversa_de===a.id)&&<button className={buttons.btnSecondary} disabled={busy} onClick={()=>{setCorregir(a);setMotivo('');setFechaCorreccion(a.fecha)}}>Revertir con corrección</button>}
        </div></details>)}
        {corregir&&<form className={styles.panel} onSubmit={e=>{e.preventDefault();void actuar('revertir',{id:corregir.id,fecha:fechaCorreccion,motivo,clave:crypto.randomUUID()}).then(()=>setCorregir(null)).catch(()=>{})}}><h4>Reversión de partida #{corregir.numero}</h4><p>El original permanece y se registran sus cargos y abonos invertidos. Después puede preparar la partida correcta.</p><div className={styles.formGrid}><label>Fecha<input required className="form-control" type="date" min={`${periodo.anio}-01-01`} max={`${periodo.anio}-12-31`} value={fechaCorreccion} onChange={e=>setFechaCorreccion(e.target.value)} /></label><label>Motivo<input required minLength={5} maxLength={400} className="form-control" value={motivo} onChange={e=>setMotivo(e.target.value)} /></label></div><div className={styles.toolbar}><button className={buttons.btnPrimary} disabled={busy}>Registrar reversión</button><button type="button" className={buttons.btnSecondary} onClick={()=>setCorregir(null)}>Cancelar</button></div></form>}
      </section>
 {form&&<PartidaForm key={form.partida?.id??'nuevo'} periodo={periodo} cuentas={base.cuentas} partida={form.partida} tipoInicial={modo==='ajustes'?'AJUSTE':'OPERACION'} busy={busy} onClose={()=>setForm(null)} onSave={async datos=>{await actuar('guardar',datos);setForm(null)}}/>}
 </>
}
