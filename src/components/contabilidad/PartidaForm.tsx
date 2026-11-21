'use client'
import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import SelectorCuenta from './SelectorCuenta'
import { validarPartida, type CuentaContable, type PartidaContable, type PeriodoContable } from '@/lib/contabilidad'
import buttons from '@/styles/shared/Button.module.css'
import styles from '@/styles/contabilidad/Contabilidad.module.css'

interface Props { periodo: PeriodoContable; cuentas: CuentaContable[]; partida: PartidaContable | null; tipoInicial?: string; busy: boolean; onClose: () => void; onSave: (datos: Record<string, unknown>) => Promise<void> }
export default function PartidaForm({ periodo, cuentas, partida, tipoInicial='OPERACION', busy, onClose, onSave }: Props) {
  const [clave] = useState(() => crypto.randomUUID())
  const [fecha, setFecha] = useState(partida?.fecha ?? `${periodo.anio}-01-01`)
  const [descripcion, setDescripcion] = useState(partida?.descripcion ?? '')
  const [tipo, setTipo] = useState(partida?.tipo ?? tipoInicial)
  const [error, setError] = useState('')
  const [lineas, setLineas] = useState(() => partida?.lineas.map(l => ({ key: crypto.randomUUID(), cuentaId: l.cuenta_id, debe: String(l.debe), haber: String(l.haber) })) ?? [0,1].map(() => ({ key: crypto.randomUUID(), cuentaId: 0, debe: '0', haber: '0' })))
  let totales = { debe: 0, haber: 0, diferencia: 0 }
  try { totales = validarPartida(lineas) } catch { /* Las filas incompletas se validan al guardar. */ }
  const setLinea = (index: number, field: 'cuentaId' | 'debe' | 'haber', value: string) => setLineas(previous => previous.map((l,i) => i === index ? { ...l, [field]: field === 'cuentaId' ? Number(value) : value } : l))
  const cuentasDisponibles = cuentas.filter(c => c.activa && (tipo==='APERTURA'?['1','2','3'].includes(c.codigo[0])&&!c.codigo.startsWith('3204'):c.imputable&&!c.codigo.startsWith('3204')))
  return <Modal show onHide={busy ? undefined : onClose} size="xl" centered backdrop="static">
    <form onSubmit={async event => {
      event.preventDefault(); setError('')
      try {
        validarPartida(lineas)
        await onSave({ id: partida?.id, clave, fecha, descripcion, tipo, lineas: lineas.map(({ cuentaId, debe, haber }) => ({ cuentaId, debe, haber })) })
      } catch (err) { setError((err as Error).message) }
    }}>
      <Modal.Header closeButton={!busy}><Modal.Title>{partida ? `Editar borrador #${partida.numero}` : 'Nueva partida'}</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className={styles.formGrid}>
          <label>Fecha<input className="form-control" type="date" required value={fecha} min={`${periodo.anio}-01-01`} max={`${periodo.anio}-12-31`} onChange={e => setFecha(e.target.value)} /></label>
          <label>Tipo<select className="form-select" value={tipo} disabled={tipo==='APERTURA'||tipoInicial==='AJUSTE'} onChange={e => setTipo(e.target.value)}>
            <option value="OPERACION">Operación</option><option value="AJUSTE">Ajuste de período</option><option value="CORRECCION">Corrección</option>
            {(tipo==='APERTURA'||tipoInicial==='APERTURA') && <option value="APERTURA">Apertura inicial</option>}
          </select></label>
        </div>
        <label className={styles.fullLabel}>Concepto<textarea className="form-control" required minLength={3} maxLength={500} value={descripcion} onChange={e => setDescripcion(e.target.value)} /></label>
        <p className={styles.muted}>Se guardará como borrador. Al contabilizarlo, las líneas serán inmutables y el Debe deberá coincidir exactamente con el Haber.</p>
        <div className={styles.scroll}><table className={styles.table}><thead><tr><th>Cuenta ANF</th><th>Debe</th><th>Haber</th><th>Acción</th></tr></thead><tbody>
          {lineas.map((l,i) => <tr key={l.key}><td><SelectorCuenta cuentas={cuentasDisponibles} cuentaId={l.cuentaId} linea={i+1} disabled={busy} onChange={value => setLinea(i,'cuentaId',value)} /></td><td><input aria-label={`Debe de línea ${i+1}`} className="form-control" type="number" min="0" step="0.01" required value={l.debe} onChange={e => setLinea(i,'debe',e.target.value)} /></td>
          <td><input aria-label={`Haber de línea ${i+1}`} className="form-control" type="number" min="0" step="0.01" required value={l.haber} onChange={e => setLinea(i,'haber',e.target.value)} /></td>
          <td><button type="button" className={buttons.btnSecondary} disabled={lineas.length <= 2 || busy} onClick={() => setLineas(previous => previous.filter((_,index) => index !== i))}>Quitar</button></td></tr>)}
        </tbody><tfoot><tr><th>Total</th><td>{totales.debe.toFixed(2)}</td><td>{totales.haber.toFixed(2)}</td><td>Diferencia: {totales.diferencia.toFixed(2)}</td></tr></tfoot></table></div>
        <button type="button" className={buttons.btnSecondary} disabled={busy || lineas.length>=500} onClick={() => setLineas(previous => [...previous,{key:crypto.randomUUID(),cuentaId:0,debe:'0',haber:'0'}])}>Agregar línea</button>
        {error && <p role="alert" className={styles.error}>{error}</p>}
      </Modal.Body>
      <Modal.Footer><button type="button" className={buttons.btnSecondary} disabled={busy} onClick={onClose}>Cancelar</button><button className={buttons.btnPrimary} disabled={busy}>Guardar borrador</button></Modal.Footer>
    </form>
  </Modal>
}
