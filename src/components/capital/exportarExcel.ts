// Descarga el presupuesto de capital en Excel: una hoja de comparación y
// una hoja de flujos por proyecto. `xlsx` se carga solo al pulsar el botón.
import type { ComparacionCapital, SupuestosCapital } from '@/lib/capital'

const anios = (n: number) => Array.from({ length: n + 1 }, (_, t) => `Año ${t}`)
const texto = (v: number | null, sufijo = '') => (v == null ? 'No aplica' : `${v}${sufijo}`)

export async function exportarCapitalExcel(s: SupuestosCapital, c: ComparacionCapital): Promise<void> {
  const XLSX = await import('xlsx')
  const libro = XLSX.utils.book_new()

  const comparacion: (string | number)[][] = [
    ['Presupuesto de capital — comparación de proyectos'],
    [`TMAR ${s.tmar}% · ISR ${s.impuesto}%`],
    [],
    ['Indicador', ...c.evaluaciones.map((e) => e.nombre)],
    ['Desembolso inicial (inversión + capital de trabajo)', ...c.evaluaciones.map((e) => e.desembolsoInicial)],
    ['VAN', ...c.evaluaciones.map((e) => e.van)],
    ['TIR (%)', ...c.evaluaciones.map((e) => texto(e.tir.valor))],
    ['Relación B/C', ...c.evaluaciones.map((e) => texto(e.bc))],
    ['Payback simple (años)', ...c.evaluaciones.map((e) => texto(e.paybackSimple))],
    ['Payback descontado (años)', ...c.evaluaciones.map((e) => texto(e.paybackDescontado))],
    ['¿VAN > 0?', ...c.evaluaciones.map((e) => (e.criterios.van ? 'Sí' : 'No'))],
    ['¿TIR > TMAR?', ...c.evaluaciones.map((e) => (e.criterios.tir ? 'Sí' : 'No'))],
    ['¿B/C > 1?', ...c.evaluaciones.map((e) => (e.criterios.bc ? 'Sí' : 'No'))],
    [],
    [
      'Recomendado (mayor VAN)',
      c.mejorPorVAN == null ? 'Ninguno tiene VAN positivo' : (c.evaluaciones.at(c.mejorPorVAN)?.nombre ?? ''),
    ],
  ]
  const hojaComp = XLSX.utils.aoa_to_sheet(comparacion)
  hojaComp['!cols'] = [{ wch: 48 }, ...c.evaluaciones.map(() => ({ wch: 22 }))]
  XLSX.utils.book_append_sheet(libro, hojaComp, 'Comparacion')

  c.evaluaciones.forEach((e, i) => {
    const f = e.flujos
    const n = f.ingresos.length
    const conAnio0 = (lista: number[]) => ['', ...lista]
    const filas: (string | number)[][] = [
      [e.nombre],
      [],
      ['Concepto', ...anios(n)],
      ['Ingresos', ...conAnio0(f.ingresos)],
      ['Costos en efectivo', ...conAnio0(f.costos)],
      ['Depreciación', ...conAnio0(f.depreciacion)],
      ['Utilidad antes de impuestos', ...conAnio0(f.utilidadAntesImpuestos)],
      [`Impuesto (${s.impuesto}%)`, ...conAnio0(f.impuesto)],
      ['Utilidad neta', ...conAnio0(f.utilidadNeta)],
      ['Flujo operativo', ...conAnio0(f.flujoOperativo)],
      ['Inversión inicial', ...f.inversion],
      ['Capital de trabajo', ...f.capitalTrabajo],
      ['Valor de rescate', ...f.valorRescate],
      ['Flujo neto de efectivo', ...f.flujoNeto],
    ]
    const hoja = XLSX.utils.aoa_to_sheet(filas)
    hoja['!cols'] = [{ wch: 32 }, ...anios(n).map(() => ({ wch: 13 }))]
    XLSX.utils.book_append_sheet(libro, hoja, `P${i + 1} ${e.nombre}`.replace(/[\\/?*[\]:]/g, '').slice(0, 31))
  })

  XLSX.writeFile(libro, 'presupuesto_de_capital.xlsx')
}
