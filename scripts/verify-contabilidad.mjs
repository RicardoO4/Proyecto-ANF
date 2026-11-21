import test from 'node:test'
import assert from 'node:assert/strict'
import { centavos, validarPartida, resumenContable, mayorContable, balancePostcierre } from '../src/lib/contabilidad.ts'

test('importes: centavos exactos, rechaza redondeos y valores no finitos',()=>{
  assert.equal(centavos('0.29'),29)
  for(const v of ['1.001','NaN','Infinity','1e4','',Number.MAX_SAFE_INTEGER])assert.throws(()=>centavos(v))
  assert.deepEqual(validarPartida([{cuentaId:1,debe:'0.29',haber:0},{cuentaId:2,debe:0,haber:'0.28'}]),{debe:.29,haber:.28,diferencia:.01})
  assert.throws(()=>validarPartida([{cuentaId:1,debe:1,haber:1},{cuentaId:2,debe:0,haber:2}]))
})
const linea=(cuenta_id,codigo,debe,haber)=>({cuenta_id,codigo,nombre:codigo,debe,haber})
const partida=(numero,tipo,lineas)=>({id:numero,numero,fecha:'2090-12-31',descripcion:tipo,tipo,estado:'CONTABILIZADO',autor:'test',reversa_de:null,lineas})
const partidas=[partida(1,'APERTURA',[linea(1,'1101',100,0),linea(2,'3101',0,100)]),partida(2,'OPERACION',[linea(1,'1101',50,0),linea(3,'5101.01',0,50)]),partida(3,'AJUSTE',[linea(4,'4102',10,0),linea(1,'1101',0,10)]),partida(4,'CIERRE',[linea(3,'5101.01',50,0),linea(4,'4102',0,10),linea(5,'3204',0,40)])]
test('mayor conserva cargos y abonos del cierre, comprobación posterior elimina resultados',()=>{
  assert.equal(mayorContable(partidas,1).at(-1).saldo,140)
  assert.equal(mayorContable(partidas,3).at(-1).saldo,0)
  const balance=balancePostcierre(partidas)
  assert.ok(balance.every(l=>!['4','5'].includes(l.codigo[0])))
  assert.equal(balance.reduce((n,l)=>n+centavos(l.saldo),0),0)
  assert.equal(balance.find(l=>l.codigo==='3204').saldo,-40)
})
test('EC enlaza apertura, movimientos patrimoniales y resultado sin duplicarlo',()=>{
  const base={apertura:[{codigo:'3101',saldo:100}],saldos:[{codigo:'3101',saldo:-100}],estados:{utilidad:40,balance:[{codigo:'1101',saldo:140},{codigo:'3101',saldo:100},{codigo:'3204',saldo:40}]}}
  assert.deepEqual(resumenContable(base),{activos:140,pasivos:0,patrimonio:140,utilidad:40,inicial:100,movimientos:0,patrimonioFinal:140,diferencia:0})
  const decimal=resumenContable({apertura:[{codigo:'3101',saldo:100.1}],saldos:[{codigo:'3101',saldo:-120.2}],estados:{utilidad:10.29,balance:[{codigo:'1101',saldo:130.49},{codigo:'3101',saldo:120.2},{codigo:'3204',saldo:10.29}]}})
  assert.equal(decimal.movimientos,20.1);assert.equal(decimal.patrimonioFinal,130.49);assert.equal(decimal.diferencia,0)
})
