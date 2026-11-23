import test from 'node:test'
import assert from 'node:assert/strict'
process.env.NEXT_PUBLIC_SUPABASE_URL='https://contabilidad-test.invalid'
process.env.SUPABASE_SERVICE_ROLE_KEY='local-test-key'
process.env.ANF_LOCAL_ONLY='0'
let accesos=[],rol='CONTADOR',seq=0,llamadas=[]
globalThis.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:input.url??input.href)
 assert.equal(url.hostname,'contabilidad-test.invalid')
 const tabla=url.pathname.split('/').at(-1)
 const json=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}})
 if(url.pathname==='/auth/v1/user')return json({id:'test-user',aud:'authenticated'})
 if(tabla==='usuario')return json({usuario_id:1,user_name:'prueba',rol})
 if(tabla==='acceso_usuario')return json(accesos.map(op=>({id_opcion:String(op)})))
 if(tabla==='empresa')return json({empresa_id:1,nombre_empresa:'Prueba',id_sector:1})
 if(tabla==='cont_consultar')return json({periodos:[]})
 if(tabla==='cont_operar'){llamadas.push(JSON.parse(init.body));return json({ok:true})}
 throw new Error('Llamada inesperada: '+tabla)
}
const {GET,POST}=await import('../src/app/api/v1/contabilidad/route.ts')
const {autorizar}=await import('../src/lib/permisos.ts')
const {puedeVerPagina}=await import('../src/lib/accesos.ts')
const {inicioDeUsuario}=await import('../src/lib/roles.ts')
const req=(body,method='POST',auth=true)=>new Request('http://localhost/api/v1/contabilidad',{method,headers:{...(auth?{Authorization:`Bearer test-${++seq}`}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})})
test('contabilidad: consulta requiere sesión y permiso explícito',async()=>{
 assert.equal((await GET(req(null,'GET',false))).status,401)
 assert.equal((await GET(req(null,'GET'))).status,403)
 accesos=[8];assert.equal((await GET(req(null,'GET'))).status,200)
})
test('contabilidad: comprueba permisos de cada operación y rechaza perfiles adicionales',async()=>{
 const datos={periodoId:1,id:1,tipo:'OPERACION',lineas:[{cuentaId:1,debe:1,haber:0},{cuentaId:2,debe:0,haber:1}]}
 accesos=[8,9];assert.equal((await POST(req({accion:'guardar',datos}))).status,200)
 assert.equal((await POST(req({accion:'contabilizar',datos}))).status,403)
 accesos=[8,9,10];assert.equal((await POST(req({accion:'contabilizar',datos}))).status,200)
 assert.equal((await POST(req({accion:'cerrar',datos}))).status,403)
 accesos=[8,9,10,11];assert.equal((await POST(req({accion:'cerrar',datos}))).status,200)
 assert.equal((await POST(req({accion:'perfil',datos}))).status,400)
 rol='ADMIN';assert.equal((await POST(req({accion:'perfil',datos}))).status,400)
 assert.ok(llamadas.every(l=>l.p_usuario===1&&l.p_empresa===1))
})
test('contabilidad: rechaza JSON inválido y comandos sin partida o período antes de escribir',async()=>{
 rol='ADMIN';llamadas=[]
 for(const body of [null,[],{}, {accion:'constructor'}, {accion:'guardar',datos:[]}, {accion:'cerrar',datos:{}}, {accion:'contabilizar',datos:{periodoId:1}}, {accion:'guardar',datos:{periodoId:1,lineas:[{cuentaId:1,debe:1.001,haber:0},{cuentaId:2,debe:0,haber:1}]}}])assert.equal((await POST(req(body))).status,400)
 assert.equal(llamadas.length,0)
})
test('roles: Contador entra a su área y bloquea API financieras incluso con permisos sobrantes',async()=>{
 rol='CONTADOR';accesos=[0,2,3,5,6,7,8,9,10,11]
 assert.equal(inicioDeUsuario({rol,accesos}),'/contabilidad')
 assert.equal(puedeVerPagina('/contabilidad/transacciones',{rol,accesos}),true)
 for(const path of ['/dashboard','/analisis','/ratios','/usuarios','/proyecciones','/contabilidad/accesos'])assert.equal(puedeVerPagina(path,{rol,accesos}),false)
 for(const path of ['analisis/base-financiera','ratios','presupuestos','estados-financieros','usuarios','resumen-ia']){
  await assert.rejects(()=>autorizar(new Request('http://localhost/api/v1/'+path,{headers:{Authorization:`Bearer denied-${++seq}`}})),e=>e.status===403||e.statusCode===403)
 }
 assert.equal((await GET(req(null,'GET'))).status,200)
 rol='ANALISTA';accesos=[0,2,3,6,7,8]
 assert.equal(inicioDeUsuario({rol,accesos}),'/dashboard')
 assert.equal(puedeVerPagina('/contabilidad',{rol,accesos}),false)
 assert.equal((await GET(req(null,'GET'))).status,403)
})
test('roles: reutilizar un token no conserva un rol anterior ni permisos revocados',async()=>{
 const request=()=>new Request('http://localhost/api/v1/ratios',{headers:{Authorization:'Bearer same-role-token'}})
 rol='ANALISTA';accesos=[3];await autorizar(request())
 rol='CONTADOR';accesos=[5,8,9,10]
 await assert.rejects(()=>autorizar(request()),e=>e.status===403||e.statusCode===403)
})

test('catálogo: consulta para analista y contador; modificaciones solo administrador',async()=>{
 const request=(path,method='GET')=>new Request('http://localhost/api/v1/'+path,{method,headers:{Authorization:`Bearer catalogo-${++seq}`}})
 rol='ANALISTA';accesos=[0,1,2,3,5,6,7]
 assert.equal(puedeVerPagina('/catalogo-cuentas',{rol,accesos}),true)
 assert.equal(puedeVerPagina('/empresas',{rol,accesos}),true)
 await autorizar(request('cuentas-maestro/tree'))
 for(const method of ['POST','PUT','DELETE'])await autorizar(request('empresas/1',method))
 for(const path of ['catalogo-empresa/activar','catalogo-empresa/desactivar','cuentas-maestro/tree']){
  await assert.rejects(()=>autorizar(request(path,'POST')),e=>e.status===403||e.statusCode===403)
 }
 rol='CONTADOR';accesos=[5,8,9,10,11]
 assert.equal((await POST(req({accion:'crear_cuenta',datos:{padreId:1,segmento:'01',nombre:'Prueba'}}))).status,403)
 rol='ADMIN'
 await autorizar(request('catalogo-empresa/activar','POST'))
 assert.equal((await POST(req({accion:'crear_cuenta',datos:{padreId:1,segmento:'01',nombre:'Prueba'}}))).status,200)
})
