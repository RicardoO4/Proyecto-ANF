import {
  calcularEOQ,
  calcularReorden,
  clasificacionABC,
  loteEconomico,
  puntoReorden,
  redondearInventario,
  valorAnual,
  type ProductoDemanda,
} from '../src/lib/inventarioFormulas.ts'
import { siguienteCodigoSku } from '../src/lib/inventarioSku.ts'

let fallos = 0
let total = 0

function check(nombre: string, obtenido: number | string, esperado: number | string) {
  total++
  const ok = typeof esperado === 'number'
    ? Math.abs(Number(obtenido) - esperado) <= 0.005
    : String(obtenido) === esperado
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nombre.padEnd(52)} ${String(obtenido).padStart(12)}  (esperado ${esperado})`)
  if (!ok) fallos++
}

const productos: ProductoDemanda[] = [
  { id: 1, codigoSku: 'INV-001', nombre: 'Laptop Core i5 16GB', demandaAnual: 337.1674, costoUnitario: 850.55, stockActual: 201 },
  { id: 2, codigoSku: 'INV-002', nombre: 'Monitor LED 24 pulgadas', demandaAnual: 1005.587, costoUnitario: 189.97, stockActual: 585 },
  { id: 3, codigoSku: 'INV-003', nombre: 'Teclado mecánico', demandaAnual: 2843.1777, costoUnitario: 28.03, stockActual: 305 },
  { id: 10, codigoSku: 'INV-010', nombre: 'Cable HDMI 2 m', demandaAnual: 5970.6731, costoUnitario: 7.99, stockActual: 107 },
]

const abc = clasificacionABC(productos, 0.8, 0.95)
const esperadoABC = [
  { sku: 'INV-001', valor: 286777.73, acumulado: 47.38, clase: 'A' },
  { sku: 'INV-002', valor: 191031.36, acumulado: 78.95, clase: 'A' },
  { sku: 'INV-003', valor: 79694.27, acumulado: 92.12, clase: 'B' },
  { sku: 'INV-010', valor: 47705.68, acumulado: 100, clase: 'C' },
]

console.log('\n== 1. Clasificación ABC (cortes 80% / 95%) ==')
for (const esperado of esperadoABC) {
  const item = abc.find((row) => row.codigoSku === esperado.sku)
  check(`${esperado.sku} valor anual`, item?.valorAnual ?? -1, esperado.valor)
  check(`${esperado.sku} acumulado %`, item?.acumulado ?? -1, esperado.acumulado)
  check(`${esperado.sku} clase`, item?.clase ?? '', esperado.clase)
}
check('suma valores anuales', abc.reduce((s, item) => s + item.valorAnual, 0), 605209.04)

console.log('\n== 2. EOQ (S=100, h=20%) ==')
const eoq = calcularEOQ(productos, 100, 0.2)
const esperadoEOQ = [
  { sku: 'INV-001', h: 170.11, eoq: 19.91, pedidos: 16.93 },
  { sku: 'INV-002', h: 37.99, eoq: 72.76, pedidos: 13.82 },
  { sku: 'INV-003', h: 5.61, eoq: 318.49, pedidos: 8.93 },
  { sku: 'INV-010', h: 1.6, eoq: 864.45, pedidos: 6.91 },
]
for (const esperado of esperadoEOQ) {
  const item = eoq.find((row) => row.codigoSku === esperado.sku)
  check(`${esperado.sku} H unitario`, item?.costoMantenimiento ?? -1, esperado.h)
  check(`${esperado.sku} EOQ`, item?.loteEconomico ?? -1, esperado.eoq)
  check(`${esperado.sku} pedidos/año`, item?.pedidosAnuales ?? -1, esperado.pedidos)
}

console.log('\n== 3. Punto de reorden (lead time=15 días, 365 días/año) ==')
const reorden = calcularReorden(productos, 15, 365)
const esperadoPR = [
  { sku: 'INV-001', consumo: 0.92, pr: 13.86, reposicion: 0 },
  { sku: 'INV-002', consumo: 2.76, pr: 41.33, reposicion: 0 },
  { sku: 'INV-003', consumo: 7.79, pr: 116.84, reposicion: 0 },
  { sku: 'INV-010', consumo: 16.36, pr: 245.37, reposicion: 138.37 },
]
for (const esperado of esperadoPR) {
  const item = reorden.find((row) => row.codigoSku === esperado.sku)
  check(`${esperado.sku} consumo diario`, item?.consumoDiario ?? -1, esperado.consumo)
  check(`${esperado.sku} punto de reorden`, item?.puntoReorden ?? -1, esperado.pr)
  check(`${esperado.sku} reposición sugerida`, item?.reposicionSugerida ?? -1, esperado.reposicion)
}

console.log('\n== 4. Casos límite ==')
check('valorAnual(0, 10)', valorAnual(0, 10), 0)
check('loteEconomico con h=0', loteEconomico(100, 10, 0, 10), 0)
check('puntoReorden con lead time=0', puntoReorden(100, 0), 0)
check('puntoReorden con demanda=0', puntoReorden(0, 10), 0)
check('redondeo 2 decimales', redondearInventario(1.005), 1.01)
const sinDatos = clasificacionABC([
  { id: 9, codigoSku: 'INV-Vacio', nombre: 'Sin demanda', demandaAnual: 0, costoUnitario: 10, stockActual: 0 },
])
check('ABC sin demanda: clase', sinDatos[0]?.clase ?? '', 'C')
check('ABC sin demanda: acumulado', sinDatos[0]?.acumulado ?? -1, 0)

console.log('\n== 5. Asignación automática de SKU ==')
check('sin productos', siguienteCodigoSku([]), 'INV-001')
check('tras INV-001 e INV-012', siguienteCodigoSku(['INV-001', 'INV-012', 'C4-P1']), 'INV-013')
check('tras INV-999', siguienteCodigoSku(['INV-999']), 'INV-1000')

console.log(`\n${fallos === 0 ? 'OK' : 'FAIL'}: ${total - fallos}/${total} comprobaciones de inventario.\n`)
process.exit(fallos === 0 ? 0 : 1)
