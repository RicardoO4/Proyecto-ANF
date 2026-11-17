'use client'

// Tabla de 12 meses + total, usada por todas las cédulas del presupuesto.
import { MESES } from '@/lib/presupuesto'
import styles from '@/styles/presupuesto/Presupuestos.module.css'

export type FormatoFila = 'dinero' | 'unidades'

export interface FilaMensual {
  etiqueta: string
  /** 12 valores; omitir para una fila de título de sección. */
  valores?: number[]
  formato?: FormatoFila
  /** 'suma' (por defecto), 'ultimo' (saldos), o 'ninguno'. */
  total?: 'suma' | 'ultimo' | 'ninguno'
  destacada?: boolean
  /** Pinta en rojo los valores negativos. */
  rojoSiNegativo?: boolean
  /** Pinta en rojo los valores mayores que cero (p. ej. financiamiento). */
  rojoSiPositivo?: boolean
}

const fmtDinero = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtUnidades = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export function formatear(valor: number, formato: FormatoFila = 'dinero'): string {
  return formato === 'dinero' ? fmtDinero.format(valor) : fmtUnidades.format(valor)
}

function totalDe(fila: FilaMensual): number | null {
  const v = fila.valores ?? []
  if (fila.total === 'ninguno' || v.length === 0) return null
  if (fila.total === 'ultimo') return v.at(-1) ?? 0
  return Math.round(v.reduce((s, x) => s + x, 0) * 100) / 100
}

const TablaMensual = ({ titulo, filas }: { titulo: string; filas: FilaMensual[] }) => (
  <div className={styles.tablaWrap}>
    <h4 className={styles.tablaTitulo}>{titulo}</h4>
    <table className={styles.tabla}>
      <thead>
        <tr>
          <th>Concepto</th>
          {MESES.map((m) => (
            <th key={m}>{m}</th>
          ))}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => {
          if (!f.valores) {
            return (
              <tr key={f.etiqueta} className={styles.filaSeccion}>
                <td colSpan={14}>{f.etiqueta}</td>
              </tr>
            )
          }
          const total = totalDe(f)
          const clase = (v: number) =>
            (f.rojoSiNegativo && v < 0) ? styles.negativo : f.rojoSiPositivo && v > 0 ? styles.alerta : undefined
          return (
            <tr key={f.etiqueta} className={f.destacada ? styles.filaDestacada : undefined}>
              <td>{f.etiqueta}</td>
              {f.valores.map((v, i) => (
                <td key={i} className={clase(v)}>
                  {formatear(v, f.formato)}
                </td>
              ))}
              <td className={total != null ? clase(total) : undefined}>
                {total != null ? formatear(total, f.formato) : ''}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)

export default TablaMensual
