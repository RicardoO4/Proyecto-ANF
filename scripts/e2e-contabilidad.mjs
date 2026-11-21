// Prueba real de la pantalla con Edge/Chrome y Supabase LOCAL. No registra movimientos.
import {spawn} from 'node:child_process'
import {existsSync,mkdirSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}})
assert.ok(['127.0.0.1','localhost'].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname),'Solo Supabase local')
const base=process.env.E2E_BASE_URL??'http://127.0.0.1:3100'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Solo servidor local')
const executable=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)
assert.ok(executable,'Instale Edge o Chrome')
const output=resolve('.local-data/e2e-contabilidad');mkdirSync(output,{recursive:true})
const browser=spawn(executable,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9336',`--user-data-dir=${resolve('.next/contabilidad-browser-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let ws,id=0,adminToken
const temporales=[]
const empresasTemporales=new Set()
const pending=new Map(),errors=[]
const delay=ms=>new Promise(r=>setTimeout(r,ms))
async function until(check){for(let i=0;i<300;i++){if(await check())return;await delay(150)}throw new Error('La pantalla no alcanzó el estado esperado')}
function command(method,params={}){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value}
const click=texto=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText===${JSON.stringify(texto)});if(!b)throw Error('No existe botón');b.click()})()`)
try{
 await until(async()=>{try{return(await fetch('http://127.0.0.1:9336/json/version')).ok}catch{return false}})
 const tab=await(await fetch(`http://127.0.0.1:9336/json/new?${encodeURIComponent(base)}`,{method:'PUT'})).json()
 ws=new WebSocket(tab.webSocketDebuggerUrl)
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})})
 ws.addEventListener('message',e=>{
  const m=JSON.parse(String(e.data))
  if(m.id){const p=pending.get(m.id);pending.delete(m.id);if(m.error)p?.reject(new Error(m.error.message));else p?.resolve(m.result)}
  if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description??m.params.exceptionDetails.text)
  if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value??a.description??'').join(' '))
 })
 await command('Page.enable');await command('Runtime.enable')
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',contrasena:'admin123'})})
 assert.equal(login.status,200)
 const {token,...user}=await login.json()
 adminToken=token
 const api=await fetch(base+'/api/v1/contabilidad',{headers:{Authorization:`Bearer ${token}`}})
 assert.equal(api.status,200)
 const data=await api.json();assert.ok([2023,2024,2025].every(anio=>data.periodos.some(p=>p.origen==='HISTORICO'&&p.anio===anio)))
 const injection=await command('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('analisis_token',${JSON.stringify(token)});sessionStorage.setItem('analisis_user',${JSON.stringify(JSON.stringify(user))});sessionStorage.setItem('analisis_last_activity',String(Date.now()));`})
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 await command('Page.navigate',{url:base+'/contabilidad'})
 await until(()=>evaluate("document.querySelector('h1')?.innerText==='Inicio contable'&&!document.body.innerText.includes('Cargando ejercicio')"))
 writeFileSync(resolve(output,'inicio.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
 const select=await evaluate("document.querySelector('select').value")
 for(const [path,title] of [['ejercicios','Ejercicios'],['catalogo','Catálogo de cuentas'],['transacciones','Transacciones'],['libros','Libros contables'],['libros/diario','Diario contable'],['libros/mayor','Libro mayor'],['libros/comprobacion','Balance de comprobación'],['ajustes','Ajustes y revisión'],['estados','Estados financieros'],['cierre','Publicación y cierre'],['auditoria','Auditoría']]){
  // Navegación real de Next.js: el ejercicio seleccionado se mantiene entre páginas.
  if(path.startsWith('libros/')){
   await evaluate("[...document.querySelectorAll('aside a')].find(a=>a.getAttribute('href')==='/contabilidad/libros').click()")
   await until(()=>evaluate("document.querySelector('h1')?.innerText==='Libros contables'"))
   await evaluate(`[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')===${JSON.stringify('/contabilidad/'+path)}).click()`)
  }else await evaluate(`[...document.querySelectorAll('aside a')].find(a=>a.getAttribute('href')===${JSON.stringify('/contabilidad/'+path)}).click()`)
  await until(()=>evaluate(`document.querySelector('h1')?.innerText===${JSON.stringify(title)}&&!document.body.innerText.includes('Cargando ejercicio')`))
  assert.equal(await evaluate("document.querySelector('select').value"),select)
  assert.equal(await evaluate("Boolean(document.querySelector('[role=alert]'))"),false,`Error en pantalla ${path}`)
 }
 await evaluate("[...document.querySelectorAll('aside a')].find(a=>a.getAttribute('href')==='/contabilidad/estados').click()")
 await until(()=>evaluate("document.querySelector('h1')?.innerText==='Estados financieros'"))
 await click('Estado de Resultados');await click('Estado de Capital');await click('Balance General')
 const screenshot=await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
 writeFileSync(resolve(output,'estados.png'),Buffer.from(screenshot.data,'base64'))
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await delay(200)
 writeFileSync(resolve(output,'movil.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
 await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier})
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 for(const rol of ['CONTADOR','ANALISTA']){
  const userName=`e2e_${rol.toLowerCase()}_${Date.now()}`
  const created=await fetch(base+'/api/v1/usuarios',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({nombreUsuario:'Prueba',apellidoUsuario:'Temporal',userName,contrasena:'E2eTemporal123!',rol})})
  assert.equal(created.status,201,await created.text().then(t=>{try{return JSON.parse(t)}catch{return t}}))
  // Consultar por nombre permite limpiar la cuenta incluso si falla el inicio de sesión.
  const users=await(await fetch(base+'/api/v1/usuarios',{headers:{Authorization:`Bearer ${token}`}})).json()
  temporales.push(users.find(u=>u.userName===userName).usuarioId)
  await evaluate('sessionStorage.clear()')
  await command('Page.navigate',{url:base+'/'})
  await until(()=>evaluate("Boolean(document.getElementById('userName'))"))
  await until(()=>evaluate("Object.keys(document.getElementById('userName')??{}).some(k=>k.startsWith('__reactProps'))"))
  await evaluate(`(()=>{for(const [id,value] of [['userName',${JSON.stringify(userName)}],['password','E2eTemporal123!']]){const input=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}})()`)
  await evaluate("document.querySelector('form button[type=submit]').click()")
  const inicio=rol==='CONTADOR'?'/contabilidad':'/dashboard'
  await until(()=>evaluate(`location.pathname===${JSON.stringify(inicio)}&&Boolean(document.querySelector('aside'))`))
  const sessionToken=await evaluate("sessionStorage.getItem('analisis_token')")
  const denied=await fetch(base+(rol==='CONTADOR'?'/api/v1/ratios':'/api/v1/contabilidad'),{headers:{Authorization:`Bearer ${sessionToken}`}})
  assert.equal(denied.status,403)
  if(rol==='CONTADOR'){
   await until(()=>evaluate("document.querySelector('h1')?.innerText==='Inicio contable'&&!document.body.innerText.includes('Cargando ejercicio')"))
   writeFileSync(resolve(output,'contador.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
   assert.equal(await evaluate("[...document.querySelectorAll('aside a')].every(a=>a.getAttribute('href').startsWith('/contabilidad'))"),true)
   await command('Page.navigate',{url:base+'/contabilidad/catalogo'})
   await until(()=>evaluate("document.querySelector('h1')?.innerText==='Catálogo de cuentas'&&Boolean(document.querySelector('tbody tr'))"))
   assert.equal(await evaluate("Boolean(document.querySelector('form'))"),false)
   assert.equal((await fetch(base+'/api/v1/contabilidad',{method:'POST',headers:{Authorization:`Bearer ${sessionToken}`,'Content-Type':'application/json'},body:JSON.stringify({accion:'crear_cuenta',datos:{}})})).status,403)
   await command('Page.navigate',{url:base+'/analisis'})
   await until(()=>evaluate("document.body.innerText.includes('No tiene permiso para acceder')"))
  }else{
   await until(()=>evaluate("Boolean(document.querySelector('aside a[href=\"/empresas\"]'))&&Boolean(document.querySelector('aside a[href=\"/catalogo-cuentas\"]'))"))
   await command('Page.navigate',{url:base+'/catalogo-cuentas'})
   await until(()=>evaluate("Boolean(document.querySelector('table tbody tr'))&&!document.body.innerText.includes('Cargando catálogo')"))
   assert.equal(await evaluate("document.querySelectorAll('input[type=checkbox]').length"),0)
   assert.equal(await evaluate("[...document.querySelectorAll('th')].some(t=>t.innerText==='Acción')"),false)
   writeFileSync(resolve(output,'catalogo-lectura.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
   for(const accion of ['activar','desactivar'])assert.equal((await fetch(base+'/api/v1/catalogo-empresa/'+accion,{method:'POST',headers:{Authorization:`Bearer ${sessionToken}`,'Content-Type':'application/json'},body:'{}'})).status,403)
   await command('Page.navigate',{url:base+'/empresas'})
   await until(()=>evaluate("Boolean([...document.querySelectorAll('button')].find(b=>b.innerText.includes('Nueva Empresa')))"))
   await click('Nueva Empresa')
   await until(()=>evaluate("document.querySelector('select[name=idSector]')?.options.length>1"))
   assert.equal(await evaluate("Boolean(document.querySelector('select[name=usuarioId]'))"),false)
   const nombre=`Empresa e2e ${Date.now()}`,editado=nombre+' editada'
   empresasTemporales.add(nombre);empresasTemporales.add(editado)
   await evaluate(`(()=>{const input=document.querySelector('input[name=nombreEmpresa]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(nombre)});input.dispatchEvent(new Event('input',{bubbles:true}));const sector=document.querySelector('select[name=idSector]');sector.value=sector.options[1].value;sector.dispatchEvent(new Event('change',{bubbles:true}));})()`)
   await click('Guardar Empresa')
   await until(()=>evaluate(`!document.querySelector('.modal.show')&&[...document.querySelectorAll('tbody tr')].some(r=>r.cells[1]?.innerText===${JSON.stringify(nombre)})`))
   await evaluate(`[...document.querySelectorAll('tbody tr')].find(r=>r.cells[1]?.innerText===${JSON.stringify(nombre)}).querySelector('button').click()`)
   await until(()=>evaluate("Boolean(document.querySelector('.modal.show input[name=nombreEmpresa]'))"))
   await evaluate(`(()=>{const input=document.querySelector('.modal.show input[name=nombreEmpresa]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(editado)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
   await click('Guardar Cambios')
   await until(()=>evaluate(`!document.querySelector('.modal.show')&&[...document.querySelectorAll('tbody tr')].some(r=>r.cells[1]?.innerText===${JSON.stringify(editado)})`))
   await evaluate(`[...document.querySelectorAll('tbody tr')].find(r=>r.cells[1]?.innerText===${JSON.stringify(editado)}).querySelectorAll('button')[1].click()`)
   await until(()=>evaluate("Boolean(document.querySelector('.swal2-confirm'))"))
   await evaluate("document.querySelector('.swal2-confirm').click()")
   await until(()=>evaluate(`![...document.querySelectorAll('tbody tr')].some(r=>r.cells[1]?.innerText===${JSON.stringify(editado)})`))
  }
 }
 assert.deepEqual(errors,[])
 console.log('PASS navegador: pantallas contables, estados, roles, catálogo de solo lectura y creación, edición y eliminación de empresas por el analista; sin Gemini.')
}finally{
 if(ws?.readyState===WebSocket.OPEN){try{await command('Browser.close')}catch{}ws.close()}browser.kill()
 const empresas=await(await fetch(base+'/api/v1/empresas',{headers:{Authorization:`Bearer ${adminToken}`}})).json()
 for(const e of empresas.filter(e=>empresasTemporales.has(e.nombreEmpresa)))await fetch(base+'/api/v1/empresas/'+e.empresaId,{method:'DELETE',headers:{Authorization:`Bearer ${adminToken}`}})
 for(const id of temporales)await fetch(base+'/api/v1/usuarios/'+id,{method:'DELETE',headers:{Authorization:`Bearer ${adminToken}`}})
}
