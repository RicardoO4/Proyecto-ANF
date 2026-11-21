// Prueba real de la pantalla con Edge/Chrome y Supabase LOCAL. No modifica datos ni llama a IA.
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
const output=resolve('.local-data/e2e-dashboard');mkdirSync(output,{recursive:true})
const browser=spawn(executable,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9337',`--user-data-dir=${resolve('.local-data/dashboard-browser-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let ws,id=0
const pending=new Map(),errors=[]
const delay=ms=>new Promise(r=>setTimeout(r,ms))
async function until(check){for(let i=0;i<300;i++){if(await check())return;await delay(150)}throw new Error('La pantalla no alcanzó el estado esperado')}
function command(method,params={}){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value}
const click=texto=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText===${JSON.stringify(texto)});if(!b)throw Error('No existe botón');b.click()})()`)
try{
 await until(async()=>{try{return(await fetch('http://127.0.0.1:9337/json/version')).ok}catch{return false}})
 const tab=await(await fetch(`http://127.0.0.1:9337/json/new?${encodeURIComponent(base)}`,{method:'PUT'})).json()
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


 const headers={Authorization:`Bearer ${token}`}
 assert.equal((await fetch(base+'/api/v1/dashboard')).status,401)
 const response=await fetch(base+'/api/v1/dashboard',{headers})
 assert.equal(response.status,200,await response.clone().text())
 const data=await response.json()
 assert.ok(data.seleccionado&&data.anios.length)
 assert.ok(data.historico.length<=5)
 for(const year of data.historico){
  const r=await fetch(base+'/api/v1/analisis/base-financiera?anio='+year.anio,{headers})
  assert.equal(r.status,200)
  const financial=await r.json()
  for(const field of ['ventas','ingresos','costosGastos','utilidad','activos','pasivos','patrimonio','efectivo']){
   if(year[field]!==null)assert.equal(year[field],financial[field],`${year.anio}: ${field}`)
  }
 }
 assert.equal((await fetch(base+'/api/v1/dashboard?anio=hola',{headers})).status,400)
 assert.equal((await fetch(base+'/api/v1/dashboard?anio=1900',{headers})).status,404)
 const accountant=await(await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'contador',contrasena:'Contador123!'})})).json()
 assert.equal((await fetch(base+'/api/v1/dashboard',{headers:{Authorization:`Bearer ${accountant.token}`}})).status,403)
 await command('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('analisis_token',${JSON.stringify(token)});sessionStorage.setItem('analisis_user',${JSON.stringify(JSON.stringify(user))});sessionStorage.setItem('analisis_last_activity',String(Date.now()));`})
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false})
 await command('Page.navigate',{url:base+'/dashboard'})
 await until(()=>evaluate("document.querySelector('[aria-label=\"Cifras principales\"]')&&document.querySelectorAll('.recharts-surface').length>=2"))
 assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Cifras principales\"] article').length"),4)
 assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true)
 writeFileSync(resolve(output,'desktop.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
 const earlier=data.anios.find(a=>a!==data.seleccionado.anio)
 if(earlier){
  await evaluate(`(()=>{const s=document.querySelector('select[aria-label="Ejercicio del resumen financiero"]');const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(s,'${earlier}');s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  await until(()=>evaluate(`document.querySelector('[aria-label="Cifras principales"]')&&document.querySelector('select').value==='${earlier}'&&document.querySelector('#indicadores-title').parentElement.parentElement.innerText.includes('${earlier}')`))
 }
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await evaluate("window.dispatchEvent(new Event('resize'))")
 await until(()=>evaluate("document.querySelector('aside').getBoundingClientRect().right<=1"))
 await delay(500)
 await until(()=>evaluate("[...document.querySelectorAll('.recharts-wrapper')].every(e=>Math.abs(e.getBoundingClientRect().width-e.parentElement.getBoundingClientRect().width)<1)"))
 assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true,'Sin desborde horizontal en móvil')
 writeFileSync(resolve(output,'mobile.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
 let fixture=null,status=200
 ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.method==='Fetch.requestPaused')void command('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:status,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(fixture)).toString('base64')})})
 await command('Fetch.enable',{patterns:[{urlPattern:'*/api/v1/dashboard*',requestStage:'Request'}]})
 fixture={empresa:data.empresa,anios:[],seleccionado:null,anterior:null,historico:[]}
 await evaluate("document.querySelector('[aria-label=\"Actualizar resumen financiero\"]').click()")
 await until(()=>evaluate("document.body.innerText.includes('Tu resumen financiero comienza')"))
 fixture={...data,seleccionado:{...data.seleccionado,tieneResultados:false,ventas:null,ingresos:null,costosGastos:null,utilidad:null,margen:null,rentabilidad:null}}
 await evaluate("document.querySelector('[aria-label=\"Actualizar resumen financiero\"]').click()")
 await until(()=>evaluate("document.body.innerText.includes('Sin informaci\\u00f3n')&&Boolean(document.querySelector('[aria-label=\"Cifras principales\"]'))"))
 status=503;fixture={message:'Servicio temporalmente no disponible'}
 await evaluate("document.querySelector('[aria-label=\"Actualizar resumen financiero\"]').click()")
 await until(()=>evaluate("document.body.innerText.includes('No se pudo cargar el resumen')"))
 status=200;fixture=data
 await click('Volver a intentar')
 await until(()=>evaluate("Boolean(document.querySelector('[aria-label=\"Cifras principales\"]'))"))
 assert.deepEqual(errors.filter(e=>!e.includes('503')&&!e.includes('AxiosError')),[])
 console.log('PASS: API local contra cifras ANF, 401/403/400/404, cuatro tarjetas, cambio anual, gráficas, escritorio y móvil sin desborde, estados vacío/incompleto/error y recuperación. Sin escrituras ni IA.')
}finally{
 if(ws?.readyState===WebSocket.OPEN){try{await command('Browser.close')}catch{}ws.close()}browser.kill()
}
