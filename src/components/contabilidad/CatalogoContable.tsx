'use client'
import { useState } from 'react'
import type { CuentaContable } from '@/lib/contabilidad'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import buttons from '@/styles/shared/Button.module.css'

export default function CatalogoContable({cuentas,puedeCrear,busy,crear}:{cuentas:CuentaContable[];puedeCrear:boolean;busy:boolean;crear:(datos:Record<string,unknown>)=>Promise<void>}){
  const [buscar,setBuscar]=useState('')
  const [padre,setPadre]=useState('')
  const [segmento,setSegmento]=useState('')
  const [nombre,setNombre]=useState('')
  const [error,setError]=useState('')
  const cuentaPadre=cuentas.find(c=>c.id===Number(padre))
  return <section>
    <h3>Catálogo de cuentas ANF</h3>
    <p className={styles.muted}>Se utiliza el catálogo del análisis financiero. La clasificación de cada subcuenta se hereda de su cuenta padre. Las cuentas con subcuentas agrupan movimientos; las imputables reciben operaciones.</p>
    <label className={styles.fullLabel}>Buscar código o nombre<input className="form-control" value={buscar} onChange={e=>setBuscar(e.target.value)} /></label>
    <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Código</th><th>Cuenta</th><th>Clasificación</th><th>Uso</th><th>Estado</th></tr></thead><tbody>{cuentas.filter(c=>(c.codigo+' '+c.nombre).toLocaleLowerCase().includes(buscar.toLocaleLowerCase())).map(c=><tr key={c.id}><td>{c.codigo}</td><td>{c.nombre}</td><td>{c.tipo}</td><td>{c.imputable?'Movimientos':'Agrupación'}</td><td>{c.activa?'Activa':'Inactiva'}</td></tr>)}</tbody></table></div>
    {puedeCrear&&<form className={styles.panel} onSubmit={async e=>{
      e.preventDefault();setError('')
      try{await crear({padreId:Number(padre),segmento,nombre});setSegmento('');setNombre('')}
      catch(err){setError((err as Error).message)}
    }}>
      <h4>Registrar subcuenta</h4><div className={styles.formGrid}>
        <label>Cuenta padre<select className="form-select" required value={padre} onChange={e=>setPadre(e.target.value)}><option value="">Seleccione cuenta ANF</option>{cuentas.filter(c=>c.activa&&c.codigo.length>=4&&!c.codigo.startsWith('3204')&&['1','2','3','4','5'].includes(c.codigo[0])).map(c=><option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}</select></label>
        <label>Segmento numérico<input className="form-control" required pattern="[0-9]{2,6}" maxLength={6} placeholder="01" value={segmento} onChange={e=>setSegmento(e.target.value)} /></label>
        <label>Nombre<input className="form-control" required minLength={3} maxLength={256} value={nombre} onChange={e=>setNombre(e.target.value)} /></label>
      </div><p className={styles.muted}>Código: {cuentaPadre?`${cuentaPadre.codigo}.${segmento||'…'}`:'Seleccione cuenta padre'} · Clasificación: {cuentaPadre?.tipo??'—'}. La cuenta padre pasará a agrupación. Sus movimientos anteriores se conservan.</p>
      <button className={buttons.btnPrimary} disabled={busy}>Crear subcuenta activa</button>{error&&<p role="alert" className={styles.error}>{error}</p>}
    </form>}
  </section>
}
