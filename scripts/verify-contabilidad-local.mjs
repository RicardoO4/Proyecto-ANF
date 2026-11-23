// Prueba transaccional contra la base LOCAL; todos los datos de prueba se revierten.
import pg from 'pg'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const db=new pg.Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:54322/postgres'})
await db.connect()
try {
 await db.query('BEGIN')
 // Reconstruir el módulo dentro de ESTA transacción verifica también una instalación
 // nueva de la migración. El rollback restaura tablas, datos, funciones y permisos.
 const funciones=(await db.query("SELECT oid::regprocedure::text firma FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname LIKE 'cont_%'")).rows
 await db.query('DROP TABLE cont_publicacion,cont_linea,cont_asiento,cont_auditoria,cont_periodo CASCADE')
 for(const f of funciones)await db.query(`DROP FUNCTION IF EXISTS ${f.firma} CASCADE`)
 const migracion=readFileSync('supabase/migrations/20261121031025_integracion_contable.sql','utf8')
   .replace(/\r?\nBEGIN;\r?\n/,'\n').replace(/\r?\nCOMMIT;\s*$/,'\n')
 await db.query(migracion)
 const roles=readFileSync('supabase/migrations/20261121043422_espacio_contable_roles.sql','utf8')
   .replace(/\r?\nBEGIN;\r?\n/,'\n').replace(/\r?\nCOMMIT;\s*$/,'\n')
 await db.query(roles)
 await db.query('ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_tres_roles')
 const legacy=(await db.query("INSERT INTO usuario(nombre_usuario,apellido_usuario,user_name,contrasena,rol) VALUES('Anterior','Prueba','prueba_usuario_anterior','local-test','USER') RETURNING usuario_id")).rows[0].usuario_id
 const simples=readFileSync('supabase/migrations/20261121051530_simplificar_roles_y_textos_contables.sql','utf8')
   .replace(/\r?\nBEGIN;\r?\n/,'\n').replace(/\r?\nCOMMIT;\s*$/,'\n')
 await db.query(simples)
 const consultas=readFileSync('supabase/migrations/20261121053229_catalogo_lectura_y_consulta_empresas.sql','utf8')
   .replace(/^BEGIN;\r?\n/,'\n').replace(/\r?\nCOMMIT;\s*$/,'\n')
 await db.query(consultas)
 assert.equal((await db.query('SELECT rol FROM usuario WHERE usuario_id=$1',[legacy])).rows[0].rol,'ANALISTA')
 const user=Number((await db.query("SELECT usuario_id FROM usuario WHERE rol='ADMIN' LIMIT 1")).rows[0].usuario_id)
 const snapshot=JSON.parse(readFileSync('.local-data/anf-snapshot.json','utf8')).tablas
 const empresaReal=snapshot.empresa[0].empresa_id
 const original=(await db.query('SELECT * FROM linea_estado_financiero ORDER BY id_linea')).rows
 await db.query("SELECT cont_operar($1,$2,'importar','{}')",[empresaReal,user])
 await db.query("SELECT cont_operar($1,$2,'importar','{}')",[empresaReal,user])
 assert.deepEqual((await db.query('SELECT * FROM linea_estado_financiero ORDER BY id_linea')).rows,original)
 const historicos=(await db.query("SELECT id,anio FROM cont_periodo WHERE empresa_id=$1 AND origen='HISTORICO'",[empresaReal])).rows
 const aniosFuente=[...new Set(snapshot.estado_financiero.map(e=>e.anio))]
 assert.ok(aniosFuente.every(anio=>historicos.some(p=>p.anio===anio)))
 for(const periodo of historicos.filter(p=>aniosFuente.includes(p.anio))){
   const estados=(await db.query('SELECT cont_estados($1) datos',[periodo.id])).rows[0].datos
   for(const [tipo,filas] of [['BALANCE_GENERAL',estados.balance],['ESTADO_RESULTADOS',estados.resultados]]){
     const sid=snapshot.estado_financiero.find(e=>e.empresa_id===empresaReal&&e.anio===periodo.anio&&e.tipo_reporte===tipo).id_estado_financiero
     const esperado=snapshot.linea_estado_financiero.filter(l=>l.id_estado_financiero===sid)
     assert.equal(filas.length,esperado.length)
     for(const linea of esperado)assert.equal(Number(filas.find(f=>f.cuentaId===linea.cuenta_id).saldo),Number(linea.saldo))
   }
 }
 const eid=Number((await db.query("INSERT INTO empresa(nombre_empresa) VALUES('Prueba transaccional contable') RETURNING empresa_id")).rows[0].empresa_id)
 await db.query('INSERT INTO catalogo(empresa_id,cuenta_id,activo) SELECT $1,cuenta_id,true FROM cuenta',[eid])
 const padreNuevo=(await db.query("SELECT cuenta_id FROM cuenta WHERE cue_cuenta_id='1101.01.02'")).rows[0].cuenta_id
 const nueva=(await db.query("SELECT cont_operar($1,$2,'crear_cuenta',$3) datos",[eid,user,JSON.stringify({padreId:padreNuevo,segmento:'999999',nombre:'Caja de prueba'})])).rows[0].datos
 assert.ok(nueva.cuentaId)
 assert.equal((await db.query('SELECT is_postable FROM cuenta WHERE cuenta_id=$1',[padreNuevo])).rows[0].is_postable,false)
 const codes=(await db.query("SELECT cuenta_id,cue_cuenta_id FROM cuenta WHERE cue_cuenta_id IN ('1101.01','1101.01.01','3101.01.01','5101.01.01','4102.01.01','3201.01')")).rows
 const id=code=>{const r=codes.find(c=>c.cue_cuenta_id===code);assert.ok(r,'Cuenta ANF '+code);return r.cuenta_id}
 const operar=async(accion,datos)=> (await db.query('SELECT cont_operar($1,$2,$3,$4) datos',[eid,user,accion,JSON.stringify(datos)])).rows[0].datos
 let pid=(await operar('crear_periodo',{anio:2090})).periodoId
 const vista=async()=> (await db.query('SELECT cont_consultar($1,$2) datos',[eid,pid])).rows[0].datos
 const fail=async(fn,code='ANF04')=>{await db.query('SAVEPOINT esperado');await assert.rejects(fn,e=>e.code===code);await db.query('ROLLBACK TO SAVEPOINT esperado')}
 const contador=(await db.query("INSERT INTO usuario(nombre_usuario,apellido_usuario,user_name,contrasena,rol) VALUES('Prueba','Rol','prueba_rol_contable','local-test','CONTADOR') RETURNING usuario_id")).rows[0].usuario_id
 const opciones=async()=> (await db.query('SELECT id_opcion FROM acceso_usuario WHERE usuario_id=$1 ORDER BY id_opcion',[contador])).rows.map(r=>r.id_opcion).sort()
 assert.deepEqual(await opciones(),['10','11','5','8','9'])
 await fail(()=>db.query("SELECT cont_operar($1,$2,'crear_cuenta',$3)",[eid,contador,JSON.stringify({padreId:padreNuevo,segmento:'999998',nombre:'Cuenta no autorizada'})]))
 await fail(()=>db.query("INSERT INTO acceso_usuario(usuario_id,id_opcion) VALUES($1,'2')",[contador]))
 await fail(()=>db.query("UPDATE usuario SET rol='USER' WHERE usuario_id=$1",[contador]),'23514')
 await fail(()=>db.query("SELECT cont_operar($1,$2,'perfil','{}')",[eid,user]))
 await db.query("UPDATE usuario SET rol='ANALISTA' WHERE usuario_id=$1",[contador])
 assert.deepEqual(await opciones(),['0','1','2','3','5','6','7'])
 await fail(()=>db.query("INSERT INTO acceso_usuario(usuario_id,id_opcion) VALUES($1,'8')",[contador]))
 const guardar=async(tipo,lineas,fecha='2090-12-31')=>operar('guardar',{periodoId:pid,clave:crypto.randomUUID(),fecha,descripcion:'Prueba '+tipo,tipo,lineas:lineas.map(([code,debe,haber])=>({cuentaId:id(code),debe,haber}))})
 const post=async a=>operar('contabilizar',{periodoId:pid,id:a.id})
 const apertura=await guardar('APERTURA',[['1101.01',100,0],['3101.01.01',0,100]])
 await post(apertura)
 const desbalance=await guardar('OPERACION',[['1101.01.01',50,0],['5101.01.01',0,49.99]])
 await fail(()=>post(desbalance))
 await operar('descartar',{periodoId:pid,id:desbalance.id})
 const venta=await guardar('OPERACION',[['1101.01.01',50,0],['5101.01.01',0,50]])
 await post(venta)
 const agregado=(await vista()).estados.balance.filter(r=>r.codigo.startsWith('1101'))
 assert.equal(agregado.length,1);assert.equal(agregado[0].saldo,150)
 await fail(()=>db.query('DELETE FROM cont_linea WHERE asiento_id=$1',[venta.id]))
 const ajuste=await guardar('AJUSTE',[['4102.01.01',10,0],['1101.01.01',0,10]])
 await post(ajuste)
 assert.equal((await vista()).estados.utilidad,40)
 const temporal=await guardar('OPERACION',[['1101.01.01',1,0],['5101.01.01',0,1]])
 await post(temporal)
 await operar('revertir',{periodoId:pid,id:temporal.id,fecha:'2090-12-31',motivo:'Error de registro',clave:crypto.randomUUID()})
 await fail(()=>operar('revertir',{periodoId:pid,id:temporal.id,fecha:'2090-12-31',motivo:'Error repetido',clave:crypto.randomUUID()}),'23505')
 let datos=await vista()
 await fail(()=>operar('publicar',{periodoId:pid,version:0}))
 await operar('publicar',{periodoId:pid,version:datos.periodos[0].version})
 const erAntes=(await db.query("SELECT l.* FROM linea_estado_financiero l JOIN estado_financiero e USING(id_estado_financiero) WHERE empresa_id=$1 AND tipo_reporte='ESTADO_RESULTADOS' ORDER BY id_linea",[eid])).rows
 await fail(()=>db.query('UPDATE estado_financiero SET anio=2089 WHERE empresa_id=$1',[eid]))
 await operar('cerrar',{periodoId:pid})
 datos=await vista()
 assert.equal(datos.periodos[0].estado,'CERRADO')
 assert.equal(datos.periodos[0].version,datos.publicaciones[0].version)
 assert.equal(datos.estados.utilidad,40)
 assert.deepEqual((await db.query("SELECT l.* FROM linea_estado_financiero l JOIN estado_financiero e USING(id_estado_financiero) WHERE empresa_id=$1 AND tipo_reporte='ESTADO_RESULTADOS' ORDER BY id_linea",[eid])).rows,erAntes)
 const cierres=await db.query("SELECT c.cue_cuenta_id,sum(l.debe-l.haber) saldo FROM cont_linea l JOIN cont_asiento a ON a.id=l.asiento_id JOIN cuenta c USING(cuenta_id) WHERE periodo_id=$1 AND a.estado='CONTABILIZADO' AND left(c.cue_cuenta_id,1) IN ('4','5') GROUP BY c.cue_cuenta_id",[pid])
 assert.ok(cierres.rows.every(r=>Number(r.saldo)===0))
 await operar('reabrir',{periodoId:pid,motivo:'Revisión autorizada'})
 datos=await vista()
 assert.equal(datos.estados.utilidad,40)
 await operar('publicar',{periodoId:pid,version:datos.periodos[0].version})
 await operar('cerrar',{periodoId:pid})
 const next=await operar('crear_periodo',{anio:2091,base:pid,cuentaAcumulados:id('3201.01')})
 assert.ok(next.periodoId)
 await fail(()=>operar('reabrir',{periodoId:pid,motivo:'Revisión fuera de orden'}))
 const opened=(await db.query('SELECT cont_estados($1) datos',[next.periodoId])).rows[0].datos
 assert.equal(opened.utilidad,0)
 assert.equal(opened.balance.find(r=>r.codigo==='3201.01').saldo,40)
 const anteriorPid=pid;pid=next.periodoId
 const devolucion=(await db.query("SELECT cuenta_id,cue_cuenta_id FROM cuenta WHERE cue_cuenta_id='5101.02.01'")).rows[0]
 codes.push(devolucion)
 await post(await guardar('AJUSTE',[['5101.02.01',20,0],['1101.01.01',0,20]],'2091-12-31'))
 await post(await guardar('OPERACION',[['4102.01.01',30,0],['1101.01.01',0,30]],'2091-12-31'))
 const perdida=await vista()
 assert.equal(perdida.estados.utilidad,-50);assert.equal(perdida.estados.ventas,-20)
 const periodoPerdida=perdida.periodos.find(p=>Number(p.id)===Number(pid))
 await operar('publicar',{periodoId:pid,version:periodoPerdida.version})
 await operar('cerrar',{periodoId:pid})
 assert.equal((await vista()).estados.balance.find(r=>r.codigo==='3204').saldo,-50)
 pid=anteriorPid
 // Apertura resumida: una cuenta padre conserva su saldo inicial; la subcuenta aporta movimiento exclusivo.
 const baseReal=historicos.toSorted((a,b)=>b.anio-a.anio)[0]
 const periodoReal=(await db.query("SELECT cont_operar($1,$2,'crear_periodo',$3) datos",[empresaReal,user,JSON.stringify({anio:baseReal.anio+1,base:baseReal.id,cuentaAcumulados:id('3201.01')})])).rows[0].datos.periodoId
 const before=(await db.query('SELECT cont_estados($1) datos',[periodoReal])).rows[0].datos
 const movimiento=(await db.query("SELECT cont_operar($1,$2,'guardar',$3) datos",[empresaReal,user,JSON.stringify({periodoId:periodoReal,fecha:`${baseReal.anio+1}-01-01`,clave:crypto.randomUUID(),descripcion:'Venta con apertura resumida',tipo:'OPERACION',lineas:[{cuentaId:id('1101.01.01'),debe:50,haber:0},{cuentaId:id('5101.01.01'),debe:0,haber:50}]})])).rows[0].datos
 await db.query("SELECT cont_operar($1,$2,'contabilizar',$3)",[empresaReal,user,JSON.stringify({periodoId:periodoReal,id:movimiento.id})])
 const after=(await db.query('SELECT cont_estados($1) datos',[periodoReal])).rows[0].datos
 assert.equal(after.balance.filter(l=>l.codigo.startsWith('1')).reduce((n,l)=>n+Number(l.saldo),0)-before.balance.filter(l=>l.codigo.startsWith('1')).reduce((n,l)=>n+Number(l.saldo),0),50)
 assert.equal(after.utilidad,50)
 for(const row of after.balance)assert.ok(!after.balance.some(b=>b.codigo!==row.codigo&&b.codigo.startsWith(row.codigo)))
 const rls=await db.query("SELECT relname,relrowsecurity,has_table_privilege('anon',oid,'SELECT') anon FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('cont_periodo','cont_asiento','cont_linea','cont_publicacion','cont_auditoria')")
 assert.equal(rls.rowCount,5);assert.ok(rls.rows.every(r=>r.relrowsecurity&&!r.anon))
 console.log('PASS local: migración nueva, históricos 2023–2025 idénticos e idempotentes, apertura resumida y subcuentas, centavo de diferencia, inmutabilidad, ajustes, devoluciones, pérdida, reversión, publicación, ER intacto, cierre, reapertura, traslado anual y RLS.')
} finally {await db.query('ROLLBACK');await db.end()}
