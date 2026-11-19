// Descarga el presupuesto maestro en Excel: una hoja de supuestos y una
// hoja por cédula. Usa la librería `xlsx` que el proyecto ya tiene; se carga
// solo al pulsar el botón para no aumentar el peso de la página.
import { MESES, type PresupuestoMaestro, type SupuestosPresupuesto } from '@/lib/presupuesto'
import { cedulaCaja, cedulasOperacion } from './cedulas'

export async function exportarPresupuestoExcel(s: SupuestosPresupuesto, p: PresupuestoMaestro): Promise<void> {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()

  const supuestos: (string | number)[][] = [
    [`Presupuesto maestro ${s.anio} — supuestos`],
    [],
    ['Precio unitario', s.ventas.precioUnitario],
    ['Unidades enero siguiente', s.ventas.unidadesEneroSiguiente],
    ['Ventas nov. año anterior', s.ventas.ventasNovAnterior],
    ['Ventas dic. año anterior', s.ventas.ventasDicAnterior],
    ['Inventario inicial producto (u)', s.inventarioProducto.inicialUnidades],
    ['Inventario final producto (% ventas mes sig.)', s.inventarioProducto.porcentajeFinal],
    ['MP por unidad', s.materiaPrima.unidadesPorProducto],
    ['Costo unitario MP', s.materiaPrima.costoUnitario],
    ['Inventario inicial MP (u)', s.materiaPrima.inicialUnidades],
    ['Inventario final MP (% necesidad mes sig.)', s.materiaPrima.porcentajeFinal],
    ['Horas MOD por unidad', s.manoObra.horasPorUnidad],
    ['Tarifa MOD por hora', s.manoObra.tarifaHora],
    ['CIF variable por hora MOD', s.cif.tasaVariablePorHora],
    ['CIF fijos mensuales', s.cif.fijosMensuales],
    ['Depreciación mensual (en CIF fijos)', s.cif.depreciacionMensual],
    ['Gastos de operación fijos', s.gastosOperacion.fijosMensuales],
    ['Gastos de operación variables (% ventas)', s.gastosOperacion.porcentajeVariable],
    ['Cobros: contado / 30 / 60 días / incobrable (%)', `${s.cobros.contado} / ${s.cobros.a30} / ${s.cobros.a60} / ${s.cobros.incobrable}`],
    ['Pagos de compras: contado / 30 / 60 días (%)', `${s.pagosCompras.contado} / ${s.pagosCompras.a30} / ${s.pagosCompras.a60}`],
    ['Compras nov. / dic. año anterior', `${s.pagosCompras.comprasNovAnterior} / ${s.pagosCompras.comprasDicAnterior}`],
    ['Efectivo inicial', s.caja.efectivoInicial],
    ['Saldo mínimo de efectivo', s.caja.saldoMinimo],
  ]
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(supuestos), 'Supuestos')

  for (const c of [...cedulasOperacion(p), cedulaCaja(p)]) {
    const filas: (string | number)[][] = [[c.titulo], [], ['Concepto', ...MESES, 'Total']]
    for (const f of c.filas) {
      if (!f.valores) {
        filas.push([f.etiqueta])
        continue
      }
      const total =
        f.total === 'ninguno'
          ? ''
          : f.total === 'ultimo'
            ? (f.valores.at(-1) ?? 0)
            : Math.round(f.valores.reduce((a, b) => a + b, 0) * 100) / 100
      filas.push([f.etiqueta, ...f.valores, total])
    }
    const hoja = XLSX.utils.aoa_to_sheet(filas)
    hoja['!cols'] = [{ wch: 42 }, ...MESES.map(() => ({ wch: 12 })), { wch: 14 }]
    XLSX.utils.book_append_sheet(libro, hoja, c.hoja.slice(0, 31))
  }

  XLSX.writeFile(libro, `presupuesto_maestro_${s.anio}.xlsx`)
}
