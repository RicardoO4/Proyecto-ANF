import test from 'node:test'
import assert from 'node:assert/strict'
import {describirPeriodo} from '../src/lib/periodoFinanciero.ts'
import {seleccionarVentasCompletas} from '../src/lib/ventasAnuales.ts'
import {generarProforma} from '../src/lib/proforma.ts'

const anio = new Date().getFullYear()
const abierto = {id:1,anio,origen:'CONTABILIDAD',estado:'REVISION',version:2,version_publicada:1,fechaCorte:`${anio}-03-31`}
const anual = (year,monto=1000) => ({id_venta:year,empresa_id:2,fecha_venta:`${year}-12-31`,monto_venta:monto,observacion:`Generado desde estados financieros ${year}`})

test('Publicaciones parciales conservan su corte aunque existan movimientos pendientes', () => {
  const p=describirPeriodo(anio,abierto,anio)
  assert.equal(p.estado,'PROVISIONAL');assert.equal(p.completo,false)
  assert.equal(p.fechaCorte,`${anio}-03-31`);assert.equal(p.cambiosPendientes,true)
  assert.equal(describirPeriodo(anio,{...abierto,fechaCorte:null},anio).fechaCorte,null)
  assert.equal(describirPeriodo(anio,{...abierto,estado:'CERRADO'},anio).fechaCorte,`${anio}-12-31`)
  assert.equal(describirPeriodo(anio-1,{...abierto,anio:anio-1,estado:'ABIERTO'},anio).completo,false)
})
test('Pronóstico anual excluye abiertos y futuros, conserva históricos y no duplica detalle', () => {
  const r=seleccionarVentasCompletas([anual(anio-1),anual(anio,4000),anual(anio+1)], [abierto],anio)
  assert.deepEqual(r.ventas.map(v=>v.id_venta),[anio-1])
  assert.deepEqual(r.excluidos.map(v=>v.anio),[anio,anio+1])
  assert.equal(seleccionarVentasCompletas([anual(anio)],[{...abierto,estado:'CERRADO'}],anio).ventas.length,1)
})
test('Detalle mensual solo se utiliza como año completo si contiene sus doce meses', () => {
  const meses=Array.from({length:12},(_,i)=>({...anual(anio-1),fecha_venta:`${anio-1}-${String(i+1).padStart(2,'0')}-01`,observacion:null}))
  assert.equal(seleccionarVentasCompletas(meses,[],anio).ventas.length,12)
  assert.equal(seleccionarVentasCompletas(meses.slice(1),[],anio).ventas.length,0)
})
test('Proforma impide presentar una base parcial como proyección del próximo año', () => {
  assert.throws(()=>generarProforma({periodo:describirPeriodo(anio,abierto,anio)},{}),/año base completo/)
})

process.env.NEXT_PUBLIC_SUPABASE_URL='https://periodos.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key'
globalThis.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url??input.href)
  assert.equal(url.hostname,'periodos.invalid','Sin servicios externos')
  assert.equal(init.method??'GET','GET','Sin escrituras')
  const json=d=>new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json'}})
  if(url.pathname==='/auth/v1/user')return json({id:'test',aud:'authenticated'})
  const table=url.pathname.split('/').at(-1)
  if(table==='usuario')return json({usuario_id:1,user_name:'prueba',rol:'ADMIN'})
  if(table==='acceso_usuario')return json([])
  if(table==='empresa')return json({empresa_id:2,nombre_empresa:'Prueba',id_sector:null})
  if(table==='cont_periodo')return json([abierto])
  if(table==='cont_publicacion')return json([{periodo_id:1,version:1,fechaCorte:`${anio}-03-31`,creado_en:`${anio}-04-01T12:00:00Z`}])
  if(table==='venta')return json([anual(anio-3),anual(anio-2,1100),anual(anio-1,1200),anual(anio,4000)])
  if(table==='estado_financiero')return json([anio,anio-1,anio-2,anio-3].flatMap(anio=>['BALANCE_GENERAL','ESTADO_RESULTADOS'].map(tipo_reporte=>({anio,tipo_reporte}))))
  if(table==='linea_estado_financiero')return json([{id_linea:1,saldo:100,cuenta:{cue_cuenta_id:'1101',nombre_cuenta:'Caja'}}])
  throw Error('Consulta inesperada '+table)
}
const pronostico=await import('../src/app/api/v1/ventas-historicas/pronostico/route.ts')
const sugerencia=await import('../src/app/api/v1/presupuestos/sugerencia/route.ts')
const base=await import('../src/app/api/v1/analisis/base-financiera/route.ts')
const request=path=>new Request('http://localhost/api/v1/'+path,{headers:{Authorization:'Bearer test'}})
test('API mantiene ANF abierto, pronostica desde años completos y Proforma selecciona el último completo',async()=>{
  const analisis=await base.GET(request('analisis/base-financiera'))
  assert.equal(analisis.status,200);const b=await analisis.json()
  assert.equal(b.anio,anio);assert.equal(b.periodo.estado,'PROVISIONAL');assert.equal(b.periodo.fechaCorte,`${anio}-03-31`)
  const pf=await base.GET(request('analisis/base-financiera?soloCompletos=1'))
  assert.equal(pf.status,200);assert.equal((await pf.json()).anio,anio-1)
  const p=await pronostico.GET(request('ventas-historicas/pronostico?periodicidad=anual&periodos=1'))
  assert.equal(p.status,200);const d=await p.json()
  assert.equal(d.historico.at(-1).periodo,String(anio-1));assert.equal(d.proyecciones[0].periodo,String(anio))
  assert.deepEqual(d.excluidos,[{anio,motivo:'Ejercicio provisional'}])
  const s=await sugerencia.GET(request('presupuestos/sugerencia?empresaId=2'))
  assert.equal(s.status,200);const su=await s.json()
  assert.equal(su.anioPresupuesto,anio);assert.ok(su.ventasPropuestas>1200)
})
