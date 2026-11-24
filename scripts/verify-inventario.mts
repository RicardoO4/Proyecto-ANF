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

function check(nombre: string, obtenido: number | string | null, esperado: number | string | null) {
  total++
  const ok = esperado === null || obtenido === null ? obtenido === esperado : typeof esperado === 'number'
    ? Math.abs(Number(obtenido) - esperado) <= 0.005
    : String(obtenido) === esperado
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${nombre.padEnd(52)} ${String(obtenido).padStart(12)}  (esperado ${esperado})`)
  if (!ok) fallos++
}

const productos: ProductoDemanda[] = [
  { id: 1, codigoSku: 'INV-001', nombre: 'Motor 1.6 L', demandaAnual: 260.707, costoUnitario: 1100, stockActual: 155 },
  { id: 2, codigoSku: 'INV-002', nombre: 'Motor 1.8 L', demandaAnual: 127.3542, costoUnitario: 1500, stockActual: 74 },
  { id: 3, codigoSku: 'INV-003', nombre: 'Motor 1.4 L', demandaAnual: 83.8887, costoUnitario: 950, stockActual: 9 },
  { id: 10, codigoSku: 'INV-010', nombre: 'Bujía', demandaAnual: 12521.1759, costoUnitario: 3.81, stockActual: 240 },
]

const abc = clasificacionABC(productos, 0.8, 0.95)
const esperadoABC = [
  { sku: 'INV-001', valor: 286777.7, acumulado: 47.38, clase: 'A' },
  { sku: 'INV-002', valor: 191031.3, acumulado: 78.95, clase: 'A' },
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
check('suma valores anuales', abc.reduce((s, item) => s + item.valorAnual, 0), 605208.95)

console.log('\n== 2. EOQ (S=100, h=20%) ==')
const eoq = calcularEOQ(productos, 100, 0.2)
const esperadoEOQ = [
  { sku: 'INV-001', h: 220, eoq: 15.4, pedidos: 16.93 },
  { sku: 'INV-002', h: 300, eoq: 9.21, pedidos: 13.83 },
  { sku: 'INV-003', h: 190, eoq: 9.4, pedidos: 8.92 },
  { sku: 'INV-010', h: 0.76, eoq: 1812.84, pedidos: 6.91 },
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
  { sku: 'INV-001', consumo: 0.71, pr: 10.71, reposicion: 0 },
  { sku: 'INV-002', consumo: 0.35, pr: 5.23, reposicion: 0 },
  { sku: 'INV-003', consumo: 0.23, pr: 3.45, reposicion: 0 },
  { sku: 'INV-010', consumo: 34.3, pr: 514.57, reposicion: 274.57 },
]
for (const esperado of esperadoPR) {
  const item = reorden.find((row) => row.codigoSku === esperado.sku)
  check(`${esperado.sku} consumo diario`, item?.consumoDiario ?? -1, esperado.consumo)
  check(`${esperado.sku} punto de reorden`, item?.puntoReorden ?? -1, esperado.pr)
  check(`${esperado.sku} reposición sugerida`, item?.reposicionSugerida ?? -1, esperado.reposicion)
}

console.log('\n== 4. Casos límite ==')
check('valorAnual(0, 10)', valorAnual(0, 10), 0)
check('loteEconomico con h=0: no calculable', loteEconomico(100, 10, 0, 10), null)
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
