// Offline monthly ingestion regression checks. No network or credentials.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { disponibilidadMensual, validarVentasMensuales, fechaFinDeMes } from '../src/lib/ventasMensuales.ts'
import { parseVentas } from '../src/lib/excel.ts'
const venta = (fechaVenta, montoVenta = 100) => ({ fechaVenta, montoVenta })
test('D: meses reales habilitan herramientas según sus requisitos, sin rellenar huecos', () => {
  assert.equal(disponibilidadMensual([]).clasica, false)
  assert.equal(disponibilidadMensual(['2025-01-31', '2025-03-31', '2025-04-30']).avanzada, false)
  const meses = Array.from({ length: 12 }, (_, i) => fechaFinDeMes(`2025-${String(i + 1).padStart(2, '0')}`))
  assert.equal(disponibilidadMensual(meses).clasica, true)
  assert.equal(disponibilidadMensual(['2023-01-31', ...meses]).clasica, true)
  assert.equal(disponibilidadMensual(['2023-01-31', ...meses]).avanzada, false)
})
test('D: montos cero válidos; fechas inexistentes, importes negativos y meses repetidos rechazados', () => {
  assert.equal(validarVentasMensuales([venta('2025-01-31', 0)])[0].montoVenta, 0)
  for (const filas of [[venta('2025-02-30')], [venta('2025-01-01', -1)], [venta('2025-01-01', NaN)], [venta('2025-01-01'), venta('2025-01-31')]]) assert.throws(() => validarVentasMensuales(filas))
  assert.throws(() => validarVentasMensuales([{ ...venta('2025-12-31'), observacion: 'Generado desde estados financieros 2025' }]))
  assert.equal(fechaFinDeMes('2024-02'), '2024-02-29')
  assert.equal(fechaFinDeMes('2025-12'), '2025-12-31')
})
function libro(filas) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['campo', 'valor'], ['empresaId', 2]]), 'metadata')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Fecha', 'Monto', 'Observación'], ...filas]), 'ventas')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}
test('D: Excel mensual no omite filas erróneas ni cambia el mes', () => {
  assert.equal(parseVentas(libro([['2025-12-31', 100]])).ventas[0].fechaVenta.toISOString().slice(0, 10), '2025-12-31')
  for (const filas of [[['fecha incorrecta', 100]], [['2025-02-30', 100]], [['2025-01-31', 'cien']], [['2025-01-31', -100]]]) assert.throws(() => parseVentas(libro(filas)))
  const tz = process.env.TZ
  try {
    process.env.TZ = 'America/El_Salvador'
    const fecha = new Date(2025, 11, 31)
    assert.equal(parseVentas(libro([[fecha, 100]])).ventas[0].fechaVenta.toISOString().slice(0, 10), '2025-12-31')
  } finally { if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz }
})
