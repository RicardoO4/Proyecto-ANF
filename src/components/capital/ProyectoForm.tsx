'use client'

// Formulario de un proyecto de inversión (Módulo E, E3): datos generales,
// ingresos, costos y depreciación por año, y la tabla de flujos resultante.
import {
  MAX_ANIOS,
  ajustarAnios,
  depreciacionLineal,
  flujosProyecto,
  type ProyectoInversion,
} from '@/lib/capital'
import { formatear } from '@/components/presupuesto/TablaMensual'
import buttonStyles from '@/styles/shared/Button.module.css'
import styles from '@/styles/presupuesto/Presupuestos.module.css'

interface Props {
  proyecto: ProyectoInversion
  impuesto: number
  onChange: (p: ProyectoInversion) => void
  onQuitar?: () => void
}

const aNumero = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

type CampoAnual = 'ingresos' | 'costos' | 'depreciacion'

const ProyectoForm = ({ proyecto: p, impuesto, onChange, onQuitar }: Props) => {
  const set = <K extends keyof ProyectoInversion>(campo: K, valor: ProyectoInversion[K]) => onChange({ ...p, [campo]: valor })

  const cambiarVida = (v: number) => {
    const n = Math.min(MAX_ANIOS, Math.max(1, Math.round(v)))
    onChange({
      ...p,
      vidaUtil: n,
      ingresos: ajustarAnios(p.ingresos, n),
      costos: ajustarAnios(p.costos, n),
      depreciacion: depreciacionLineal(p.inversionInicial, p.valorRescate, n),
    })
  }

  const setAnual = (campo: CampoAnual, anio: number, valor: number) =>
    set(campo, p[campo].map((x, i) => (i === anio ? valor : x)))

  const anios = Array.from({ length: p.vidaUtil }, (_, i) => i + 1)
  const fl = flujosProyecto(p, impuesto)

  const filaEditable = (etiqueta: string, campo: CampoAnual) => (
    <tr>
      <td>{etiqueta}</td>
      <td></td>
      {p[campo].map((v, i) => (
        <td key={i}>
          <input
            className={styles.celdaInput}
            type="number"
            min={0}
            value={v}
            onChange={(e) => setAnual(campo, i, aNumero(e.target.value))}
            aria-label={`${etiqueta} año ${i + 1}`}
          />
        </td>
      ))}
    </tr>
  )

  const filaCalculada = (etiqueta: string, valores: number[], desdeAnio0 = false, destacada = false) => (
    <tr className={destacada ? styles.filaDestacada : undefined}>
      <td>{etiqueta}</td>
      {!desdeAnio0 && <td></td>}
      {valores.map((v, i) => (
        <td key={i} className={v < 0 ? styles.negativo : undefined}>
          {formatear(v)}
        </td>
      ))}
    </tr>
  )

  return (
    <section className={styles.seccion}>
      <div className={styles.barra} style={{ justifyContent: 'space-between' }}>
        <div className={styles.campo} style={{ flex: 1, minWidth: 220 }}>
          <label>Nombre del proyecto</label>
          <input value={p.nombre} onChange={(e) => set('nombre', e.target.value)} />
        </div>
        {onQuitar && (
          <button type="button" className={buttonStyles.btnSecondary} onClick={onQuitar} style={{ alignSelf: 'flex-end' }}>
            Quitar proyecto
          </button>
        )}
      </div>

      <div className={styles.campos}>
        <div className={styles.campo}>
          <label>Inversión inicial ($)</label>
          <input
            type="number"
            min={0}
            value={p.inversionInicial}
            onChange={(e) => {
              const inv = aNumero(e.target.value)
              onChange({ ...p, inversionInicial: inv, depreciacion: depreciacionLineal(inv, p.valorRescate, p.vidaUtil) })
            }}
          />
        </div>
        <div className={styles.campo}>
          <label>Capital de trabajo ($)</label>
          <input type="number" min={0} value={p.capitalTrabajo} onChange={(e) => set('capitalTrabajo', aNumero(e.target.value))} />
        </div>
        <div className={styles.campo}>
          <label>Vida útil (años, máx. {MAX_ANIOS})</label>
          <input type="number" min={1} max={MAX_ANIOS} value={p.vidaUtil} onChange={(e) => cambiarVida(aNumero(e.target.value))} />
        </div>
        <div className={styles.campo}>
          <label>Valor de rescate ($)</label>
          <input
            type="number"
            min={0}
            value={p.valorRescate}
            onChange={(e) => {
              const res = aNumero(e.target.value)
              onChange({ ...p, valorRescate: res, depreciacion: depreciacionLineal(p.inversionInicial, res, p.vidaUtil) })
            }}
          />
        </div>
      </div>

      <p className={styles.ayuda} style={{ marginTop: 14 }}>
        Ingresos y costos en efectivo por año. La depreciación se propone en línea recta (inversión − rescate ÷ años) y
        puede editarla.{' '}
        <button
          type="button"
          className={buttonStyles.btnSecondary}
          style={{ padding: '2px 10px', fontSize: 12 }}
          onClick={() => set('depreciacion', depreciacionLineal(p.inversionInicial, p.valorRescate, p.vidaUtil))}
        >
          Recalcular depreciación lineal
        </button>
      </p>

      <div className={styles.tablaWrap}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Año 0</th>
              {anios.map((a) => (
                <th key={a}>Año {a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filaEditable('Ingresos', 'ingresos')}
            {filaEditable('Costos en efectivo', 'costos')}
            {filaEditable('Depreciación', 'depreciacion')}
            {filaCalculada('Utilidad antes de impuestos', fl.utilidadAntesImpuestos)}
            {filaCalculada(`Impuesto (${impuesto}%)`, fl.impuesto)}
            {filaCalculada('Utilidad neta', fl.utilidadNeta)}
            {filaCalculada('+ Depreciación = flujo operativo', fl.flujoOperativo)}
            {filaCalculada('Inversión inicial', fl.inversion, true)}
            {filaCalculada('Capital de trabajo (y recuperación)', fl.capitalTrabajo, true)}
            {filaCalculada('Valor de rescate', fl.valorRescate, true)}
            {filaCalculada('Flujo neto de efectivo', fl.flujoNeto, true, true)}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default ProyectoForm
