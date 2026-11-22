// Filas de cada cédula del presupuesto. Las usan la pantalla (TablaMensual)
// y el Excel, así ambos muestran exactamente lo mismo.
import type { PresupuestoMaestro } from '@/lib/presupuesto'
import type { FilaMensual } from './TablaMensual'

export interface Cedula {
  /** Nombre corto (también el de la hoja de Excel, máx. 31 caracteres). */
  hoja: string
  titulo: string
  filas: FilaMensual[]
}

export function cedulasOperacion(p: PresupuestoMaestro): Cedula[] {
  return [
    {
      hoja: '1 Ventas',
      titulo: `Cédula 1 · Presupuesto de ventas (precio $${p.ventas.precio})`,
      filas: [
        { etiqueta: 'Unidades a vender', valores: p.ventas.unidades, formato: 'unidades' },
        { etiqueta: 'Ventas ($)', valores: p.ventas.importe, destacada: true },
      ],
    },
    {
      hoja: '2 Produccion',
      titulo: 'Cédula 2 · Presupuesto de producción (unidades)',
      filas: [
        { etiqueta: 'Unidades a vender', valores: p.produccion.ventas, formato: 'unidades' },
          { etiqueta: '+ Inventario final efectivo', valores: p.produccion.inventarioFinal, formato: 'unidades', total: 'ultimo' },
        { etiqueta: '= Total necesario', valores: p.produccion.totalNecesario, formato: 'unidades' },
        { etiqueta: '− Inventario inicial', valores: p.produccion.inventarioInicial, formato: 'unidades', total: 'ninguno' },
        { etiqueta: '= Unidades a producir', valores: p.produccion.aProducir, formato: 'unidades', destacada: true },
      ],
    },
    {
      hoja: '3 Materia prima',
      titulo: `Cédula 3 · Materia prima y compras (costo $${p.materiaPrima.costoUnitario} por unidad de MP)`,
      filas: [
        { etiqueta: 'Unidades a producir', valores: p.materiaPrima.aProducir, formato: 'unidades' },
        { etiqueta: 'MP necesaria (unidades)', valores: p.materiaPrima.necesidad, formato: 'unidades' },
          { etiqueta: '+ Inventario final efectivo de MP', valores: p.materiaPrima.inventarioFinal, formato: 'unidades', total: 'ultimo' },
        { etiqueta: '= Total MP necesaria', valores: p.materiaPrima.totalNecesario, formato: 'unidades' },
        { etiqueta: '− Inventario inicial de MP', valores: p.materiaPrima.inventarioInicial, formato: 'unidades', total: 'ninguno' },
        { etiqueta: '= MP a comprar (unidades)', valores: p.materiaPrima.aComprar, formato: 'unidades' },
        { etiqueta: 'Compras de MP ($)', valores: p.materiaPrima.compras, destacada: true },
      ],
    },
    {
      hoja: '4 MOD',
      titulo: `Cédula 4 · Mano de obra directa (tarifa $${p.manoObra.tarifa} por hora)`,
      filas: [
        { etiqueta: 'Unidades a producir', valores: p.manoObra.aProducir, formato: 'unidades' },
        { etiqueta: 'Horas de MOD', valores: p.manoObra.horas, formato: 'unidades' },
        { etiqueta: 'Costo de MOD ($)', valores: p.manoObra.costo, destacada: true },
      ],
    },
    {
      hoja: '5 CIF',
      titulo: 'Cédula 5 · Costos indirectos de fabricación',
      filas: [
        { etiqueta: 'Horas de MOD', valores: p.cif.horas, formato: 'unidades' },
        { etiqueta: 'CIF variables', valores: p.cif.variables },
        { etiqueta: 'CIF fijos', valores: p.cif.fijos },
        { etiqueta: 'Total CIF', valores: p.cif.total, destacada: true },
        { etiqueta: '− Depreciación (no es salida de efectivo)', valores: p.cif.depreciacion },
        { etiqueta: 'CIF pagados en efectivo', valores: p.cif.efectivo, destacada: true },
      ],
    },
    {
      hoja: '6 Gastos operacion',
      titulo: 'Cédula 6 · Gastos de venta y administración',
      filas: [
        { etiqueta: 'Gastos variables (% de ventas)', valores: p.gastosOperacion.variables },
        { etiqueta: 'Gastos fijos', valores: p.gastosOperacion.fijos },
        { etiqueta: 'Total gastos de operación', valores: p.gastosOperacion.total, destacada: true },
      ],
    },
  ]
}

export function cedulaCaja(p: PresupuestoMaestro): Cedula {
  const c = p.caja
  return {
    hoja: '7 Caja',
    titulo: 'Cédula 7 · Presupuesto de caja',
    filas: [
      { etiqueta: 'Entradas' },
      { etiqueta: 'Ventas al contado', valores: c.ventasContado },
      { etiqueta: 'Cobros a 30 días', valores: c.cobros30 },
      { etiqueta: 'Cobros a 60 días', valores: c.cobros60 },
      { etiqueta: 'Total de entradas', valores: c.totalEntradas, destacada: true },
      { etiqueta: 'Desembolsos' },
      { etiqueta: 'Pago de compras al contado', valores: c.pagoComprasContado },
      { etiqueta: 'Pago de compras a 30 días', valores: c.pagoCompras30 },
      { etiqueta: 'Pago de compras a 60 días', valores: c.pagoCompras60 },
      { etiqueta: 'Mano de obra directa', valores: c.manoObra },
      { etiqueta: 'CIF en efectivo', valores: c.cif },
      { etiqueta: 'Gastos de operación', valores: c.gastosOperacion },
      ...c.otros.map((o) => ({ etiqueta: o.concepto || 'Otro desembolso', valores: o.montos })),
      { etiqueta: 'Total de desembolsos', valores: c.totalDesembolsos, destacada: true },
      { etiqueta: 'Resultado' },
      { etiqueta: 'Flujo neto de efectivo', valores: c.flujoNeto, destacada: true, rojoSiNegativo: true },
      { etiqueta: '+ Efectivo inicial', valores: c.efectivoInicial, total: 'ninguno', rojoSiNegativo: true },
      { etiqueta: '= Efectivo final', valores: c.efectivoFinal, total: 'ultimo', destacada: true, rojoSiNegativo: true },
      { etiqueta: '− Saldo mínimo de efectivo', valores: c.saldoMinimo, total: 'ninguno' },
      {
        etiqueta: 'Financiamiento total requerido',
        valores: c.financiamientoRequerido,
        total: 'ninguno',
        destacada: true,
        rojoSiPositivo: true,
      },
      { etiqueta: 'Saldo de efectivo excedente', valores: c.saldoExcedente, total: 'ninguno' },
    ],
  }
}
