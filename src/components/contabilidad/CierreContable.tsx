'use client'
import {useState} from 'react'
import {useContabilidad,dinero} from './ContabilidadContext'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
import buttons from '@/styles/shared/Button.module.css'
import {resumenContable,balancePostcierre} from '@/lib/contabilidad'
export default function CierreContable(){
 const {base,periodo,puede,busy,confirmar}=useContabilidad()
 const [motivo,setMotivo]=useState('')
 if(!base||!periodo)return <p>Selecciona un ejercicio para revisar su cierre.</p>
 const editable=periodo.origen==='CONTABILIDAD'&&periodo.estado!=='CERRADO'
 const resumen=resumenContable(base)
 return <><p className={styles.notice}>Envía los estados al análisis financiero cuando estén revisados. El cierre bloquea nuevos movimientos.</p><ul><li>{base.partidas.some(a=>a.estado==='BORRADOR')?'Hay borradores pendientes: debes contabilizarlos o descartarlos.':'No hay borradores pendientes.'}</li><li>{resumen.diferencia===0?'El balance general cuadra.':'El balance general presenta una diferencia.'}</li><li>{periodo.version_publicada===periodo.version?'Los estados actuales ya se enviaron al análisis financiero.':'Hay estados pendientes de enviar al análisis financiero.'}</li></ul>
 <section><h3>Publicar al análisis y cerrar</h3><p>El envío comparte el balance general y el estado de resultados y actualiza los indicadores. El cierre registra las partidas de cierre y conserva el resultado del ejercicio.</p><p>Diferencia Activo − Pasivo − Patrimonio: <strong>{dinero(resumen.diferencia)}</strong></p>
        {puede(11)&&periodo.origen==='CONTABILIDAD'&&<div className={styles.toolbar}>{editable?<><button className={buttons.btnSecondary} disabled={busy} onClick={()=>void confirmar('revision',periodo.estado==='ABIERTO'?'¿Pasar a revisión?':'¿Volver a período abierto?')}>{periodo.estado==='ABIERTO'?'Pasar a revisión':'Volver a abierto'}</button><button className={buttons.btnPrimary} disabled={busy} onClick={()=>void confirmar('publicar','¿Enviar el balance general y el estado de resultados al análisis financiero?',{version:periodo.version})}>Enviar al análisis financiero</button><button className={buttons.btnPrimary} disabled={busy||periodo.version!==periodo.version_publicada} onClick={()=>void confirmar('cerrar','¿Cerrar el ejercicio y bloquear nuevos movimientos?')}>Cerrar ejercicio</button></>:<form className={styles.toolbar} onSubmit={e=>{e.preventDefault();void confirmar('reabrir','¿Reabrir el ejercicio?',{motivo})}}><label>Motivo de reapertura<input required minLength={5} maxLength={400} className="form-control" value={motivo} onChange={e=>setMotivo(e.target.value)} /></label><button className={buttons.btnSecondary} disabled={busy}>Reabrir ejercicio</button></form>}</div>}
        {base.publicaciones.map(p=><details className={styles.partida} key={p.id}><summary>Publicación v{p.version} · {new Date(p.creado_en).toLocaleString('es-SV')}</summary><p>Resultado publicado: {dinero(p.estados.utilidad)}</p></details>)}
        {periodo.estado==='CERRADO'&&periodo.origen==='CONTABILIDAD'&&<div className={styles.panel}><h4>Comprobación posterior al cierre</h4><table className={styles.table}><thead><tr><th>Cuenta</th><th>Debe − Haber</th></tr></thead><tbody>{balancePostcierre(base.partidas).map(l=><tr key={l.codigo}><td>{l.codigo} · {l.nombre}</td><td>{dinero(l.saldo)}</td></tr>)}</tbody></table></div>}
      </section>
 {!puede(11)&&<p className={styles.notice}>Estas acciones están disponibles para el contador y el administrador.</p>}
 </>
}
