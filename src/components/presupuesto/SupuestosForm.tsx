'use client'

// Formulario de supuestos del presupuesto maestro (Módulo E, E1-E2).
import type { ReactNode } from 'react'
import { MESES, N_MESES, type SupuestosPresupuesto } from '@/lib/presupuesto'
import buttonStyles from '@/styles/shared/Button.module.css'
import styles from '@/styles/presupuesto/Presupuestos.module.css'

interface Props {
  supuestos: SupuestosPresupuesto
  onChange: (s: SupuestosPresupuesto) => void
  /** Panel para proponer las ventas (va dentro de la sección de ventas). */
  panelPropuesta?: ReactNode
}

const aNumero = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const Campo = ({
  etiqueta,
  valor,
  onChange,
  paso = 'any',
}: {
  etiqueta: string
  valor: number
  onChange: (v: number) => void
  paso?: string
}) => (
  <div className={styles.campo}>
    <label>{etiqueta}</label>
    <input type="number" step={paso} value={valor} onChange={(e) => onChange(aNumero(e.target.value))} />
  </div>
)

const Suma = ({ valores }: { valores: number[] }) => {
  const suma = Math.round(valores.reduce((s, v) => s + v, 0) * 100) / 100
  return (
    <span className={Math.abs(suma - 100) <= 0.01 ? styles.sumaOk : styles.sumaMal}>
      Suman {suma}% {Math.abs(suma - 100) <= 0.01 ? '✓' : '(deben sumar 100%)'}
    </span>
  )
}

const SupuestosForm = ({ supuestos: s, onChange, panelPropuesta }: Props) => {
  // Copia superficial por grupo: cada cambio crea un objeto nuevo.
  const set = <K extends keyof SupuestosPresupuesto>(grupo: K, valor: SupuestosPresupuesto[K]) =>
    onChange({ ...s, [grupo]: valor })

  const setUnidades = (mes: number, v: number) =>
    set('ventas', { ...s.ventas, unidades: s.ventas.unidades.map((u, i) => (i === mes ? v : u)) })

  const setOtro = (fila: number, mes: number | 'concepto', v: string) =>
    set(
      'otrosDesembolsos',
      s.otrosDesembolsos.map((o, i) =>
        i !== fila
          ? o
          : mes === 'concepto'
            ? { ...o, concepto: v }
            : { ...o, montos: o.montos.map((m, j) => (j === mes ? aNumero(v) : m)) },
      ),
    )

  return (
    <div>
      <section className={styles.seccion}>
        <h3>1. Ventas</h3>
        <p className={styles.ayuda}>Unidades a vender por mes y precio. Puede proponerlas a partir de las ventas históricas.</p>
        {panelPropuesta}
        <div className={styles.tablaWrap}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Concepto</th>
                {MESES.map((m) => (
                  <th key={m}>{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Unidades a vender</td>
                {s.ventas.unidades.map((u, i) => (
                  <td key={MESES.at(i)}>
                    <input
                      className={styles.celdaInput}
                      type="number"
                      min={0}
                      value={u}
                      onChange={(e) => setUnidades(i, aNumero(e.target.value))}
                      aria-label={`Unidades ${MESES.at(i)}`}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.campos}>
          <Campo etiqueta="Precio unitario ($)" valor={s.ventas.precioUnitario} onChange={(v) => set('ventas', { ...s.ventas, precioUnitario: v })} />
          <Campo
            etiqueta="Unidades enero año siguiente"
            valor={s.ventas.unidadesEneroSiguiente}
            onChange={(v) => set('ventas', { ...s.ventas, unidadesEneroSiguiente: v })}
          />
          <Campo
            etiqueta="Ventas nov. año anterior ($)"
            valor={s.ventas.ventasNovAnterior}
            onChange={(v) => set('ventas', { ...s.ventas, ventasNovAnterior: v })}
          />
          <Campo
            etiqueta="Ventas dic. año anterior ($)"
            valor={s.ventas.ventasDicAnterior}
            onChange={(v) => set('ventas', { ...s.ventas, ventasDicAnterior: v })}
          />
        </div>
      </section>

      <section className={styles.seccion}>
        <h3>2. Inventario de producto terminado</h3>
        <p className={styles.ayuda}>El inventario final de cada mes es un % de las unidades que se venderán el mes siguiente.</p>
        <div className={styles.campos}>
          <Campo
            etiqueta="Inventario inicial (unidades)"
            valor={s.inventarioProducto.inicialUnidades}
            onChange={(v) => set('inventarioProducto', { ...s.inventarioProducto, inicialUnidades: v })}
          />
          <Campo
            etiqueta="Inventario final (% ventas mes sig.)"
            valor={s.inventarioProducto.porcentajeFinal}
            onChange={(v) => set('inventarioProducto', { ...s.inventarioProducto, porcentajeFinal: v })}
          />
        </div>
      </section>

      <section className={styles.seccion}>
        <h3>3. Materia prima</h3>
        <p className={styles.ayuda}>El inventario final de MP es un % de lo que necesitará la producción del mes siguiente.</p>
        <div className={styles.campos}>
          <Campo
            etiqueta="Unidades de MP por producto"
            valor={s.materiaPrima.unidadesPorProducto}
            onChange={(v) => set('materiaPrima', { ...s.materiaPrima, unidadesPorProducto: v })}
          />
          <Campo
            etiqueta="Costo por unidad de MP ($)"
            valor={s.materiaPrima.costoUnitario}
            onChange={(v) => set('materiaPrima', { ...s.materiaPrima, costoUnitario: v })}
          />
          <Campo
            etiqueta="Inventario inicial de MP (u)"
            valor={s.materiaPrima.inicialUnidades}
            onChange={(v) => set('materiaPrima', { ...s.materiaPrima, inicialUnidades: v })}
          />
          <Campo
            etiqueta="Inventario final MP (% mes sig.)"
            valor={s.materiaPrima.porcentajeFinal}
            onChange={(v) => set('materiaPrima', { ...s.materiaPrima, porcentajeFinal: v })}
          />
        </div>
      </section>

      <section className={styles.seccion}>
        <h3>4 y 5. Mano de obra directa y CIF</h3>
        <p className={styles.ayuda}>Los CIF variables dependen de las horas de MOD. La depreciación es parte de los CIF fijos pero no se paga en efectivo.</p>
        <div className={styles.campos}>
          <Campo etiqueta="Horas de MOD por unidad" valor={s.manoObra.horasPorUnidad} onChange={(v) => set('manoObra', { ...s.manoObra, horasPorUnidad: v })} />
          <Campo etiqueta="Tarifa MOD por hora ($)" valor={s.manoObra.tarifaHora} onChange={(v) => set('manoObra', { ...s.manoObra, tarifaHora: v })} />
          <Campo etiqueta="CIF variable por hora MOD ($)" valor={s.cif.tasaVariablePorHora} onChange={(v) => set('cif', { ...s.cif, tasaVariablePorHora: v })} />
          <Campo etiqueta="CIF fijos mensuales ($)" valor={s.cif.fijosMensuales} onChange={(v) => set('cif', { ...s.cif, fijosMensuales: v })} />
          <Campo etiqueta="Depreciación mensual ($)" valor={s.cif.depreciacionMensual} onChange={(v) => set('cif', { ...s.cif, depreciacionMensual: v })} />
        </div>
      </section>

      <section className={styles.seccion}>
        <h3>6. Gastos de venta y administración</h3>
        <div className={styles.campos}>
          <Campo
            etiqueta="Gastos fijos mensuales ($)"
            valor={s.gastosOperacion.fijosMensuales}
            onChange={(v) => set('gastosOperacion', { ...s.gastosOperacion, fijosMensuales: v })}
          />
          <Campo
            etiqueta="Gastos variables (% ventas)"
            valor={s.gastosOperacion.porcentajeVariable}
            onChange={(v) => set('gastosOperacion', { ...s.gastosOperacion, porcentajeVariable: v })}
          />
        </div>
      </section>

      <section className={styles.seccion}>
        <h3>7. Cobros, pagos y efectivo</h3>
        <p className={styles.ayuda}>Cobros a 30 días = se cobra el mes siguiente; a 60 días = dos meses después.</p>
        <div className={styles.campos}>
          <Campo etiqueta="Cobro al contado (%)" valor={s.cobros.contado} onChange={(v) => set('cobros', { ...s.cobros, contado: v })} />
          <Campo etiqueta="Cobro a 30 días (%)" valor={s.cobros.a30} onChange={(v) => set('cobros', { ...s.cobros, a30: v })} />
          <Campo etiqueta="Cobro a 60 días (%)" valor={s.cobros.a60} onChange={(v) => set('cobros', { ...s.cobros, a60: v })} />
          <Campo etiqueta="Incobrable (%)" valor={s.cobros.incobrable} onChange={(v) => set('cobros', { ...s.cobros, incobrable: v })} />
        </div>
        <p style={{ margin: '8px 0 16px' }}>
          <Suma valores={[s.cobros.contado, s.cobros.a30, s.cobros.a60, s.cobros.incobrable]} />
        </p>
        <div className={styles.campos}>
          <Campo etiqueta="Pago de compras al contado (%)" valor={s.pagosCompras.contado} onChange={(v) => set('pagosCompras', { ...s.pagosCompras, contado: v })} />
          <Campo etiqueta="Pago a 30 días (%)" valor={s.pagosCompras.a30} onChange={(v) => set('pagosCompras', { ...s.pagosCompras, a30: v })} />
          <Campo etiqueta="Pago a 60 días (%)" valor={s.pagosCompras.a60} onChange={(v) => set('pagosCompras', { ...s.pagosCompras, a60: v })} />
          <Campo
            etiqueta="Compras nov. año anterior ($)"
            valor={s.pagosCompras.comprasNovAnterior}
            onChange={(v) => set('pagosCompras', { ...s.pagosCompras, comprasNovAnterior: v })}
          />
          <Campo
            etiqueta="Compras dic. año anterior ($)"
            valor={s.pagosCompras.comprasDicAnterior}
            onChange={(v) => set('pagosCompras', { ...s.pagosCompras, comprasDicAnterior: v })}
          />
        </div>
        <p style={{ margin: '8px 0 16px' }}>
          <Suma valores={[s.pagosCompras.contado, s.pagosCompras.a30, s.pagosCompras.a60]} />
        </p>
        <div className={styles.campos}>
          <Campo etiqueta="Efectivo inicial ($)" valor={s.caja.efectivoInicial} onChange={(v) => set('caja', { ...s.caja, efectivoInicial: v })} />
          <Campo etiqueta="Saldo mínimo de efectivo ($)" valor={s.caja.saldoMinimo} onChange={(v) => set('caja', { ...s.caja, saldoMinimo: v })} />
        </div>
      </section>

      <section className={styles.seccion}>
        <h3>Otros desembolsos</h3>
        <p className={styles.ayuda}>Impuestos, compra de activos, dividendos, intereses u otros pagos en efectivo, por mes.</p>
        <div className={styles.tablaWrap}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Concepto</th>
                {MESES.map((m) => (
                  <th key={m}>{m}</th>
                ))}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {s.otrosDesembolsos.map((o, fila) => (
                <tr key={fila}>
                  <td>
                    <input
                      className={styles.celdaInput}
                      style={{ textAlign: 'left', minWidth: 180 }}
                      value={o.concepto}
                      onChange={(e) => setOtro(fila, 'concepto', e.target.value)}
                      aria-label="Concepto"
                    />
                  </td>
                  {o.montos.map((v, mes) => (
                    <td key={MESES.at(mes)}>
                      <input
                        className={styles.celdaInput}
                        type="number"
                        min={0}
                        value={v}
                        onChange={(e) => setOtro(fila, mes, e.target.value)}
                        aria-label={`${o.concepto} ${MESES.at(mes)}`}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className={`${buttonStyles.btnIcon} ${buttonStyles.btnIconDelete}`}
                      onClick={() => set('otrosDesembolsos', s.otrosDesembolsos.filter((_, i) => i !== fila))}
                      title="Quitar fila"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className={buttonStyles.btnSecondary}
          disabled={s.otrosDesembolsos.length >= 8}
          onClick={() =>
            set('otrosDesembolsos', [
              ...s.otrosDesembolsos,
              { concepto: 'Nuevo desembolso', montos: Array.from({ length: N_MESES }, () => 0) },
            ])
          }
        >
          Agregar desembolso
        </button>
      </section>
    </div>
  )
}

export default SupuestosForm
