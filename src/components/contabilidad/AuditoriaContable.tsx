'use client'
import {useContabilidad} from './ContabilidadContext'
import styles from '@/styles/contabilidad/Contabilidad.module.css'
const acciones: Record<string,string> = {
  CREAR_SUBCUENTA:'Subcuenta creada', IMPORTAR_SALDOS_HISTORICOS:'Histórico incorporado',
  CREAR_PERIODO:'Ejercicio abierto', GUARDAR:'Borrador guardado', DESCARTAR:'Borrador descartado',
  CONTABILIZAR:'Partida contabilizada', REVERTIR:'Partida revertida', REVISION:'Estado de revisión cambiado',
  PUBLICAR:'Estados enviados al análisis financiero', CERRAR:'Ejercicio cerrado', REABRIR:'Ejercicio reabierto',
  ASIGNAR_PERFIL:'Accesos actualizados',
}
export default function AuditoriaContable(){
  const {base}=useContabilidad()
  if(!base)return null
  return <section><h3>Historial de acciones</h3><div className={styles.scroll}>
    <table className={styles.table}>
      <thead><tr><th>Fecha</th><th>Acción</th><th>Usuario</th><th>Detalle</th></tr></thead>
      <tbody>{base.auditoria.map(a=><tr key={a.id}>
        <td>{new Date(a.creado_en).toLocaleString('es-SV')}</td>
        <td>{acciones[a.accion]??a.accion.replaceAll('_',' ').toLocaleLowerCase('es-SV')}</td>
        <td>#{a.usuario_id}</td>
        <td>{a.detalle.motivo??(a.detalle.partidaId?`Partida #${a.detalle.partidaId}`:'—')}</td>
      </tr>)}{base.auditoria.length===0&&<tr><td colSpan={4}>Todavía no hay acciones registradas.</td></tr>}</tbody>
    </table>
  </div></section>
}
