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
const output=resolve('.local-data/e2e-periodos');mkdirSync(output,{recursive:true})
const browser=spawn(executable,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9338',`--user-data-dir=${resolve('.local-data/periodos-browser-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let ws,id=0
const pending=new Map(),errors=[]
const delay=ms=>new Promise(r=>setTimeout(r,ms))
async function until(check){for(let i=0;i<300;i++){if(await check())return;await delay(150)}throw new Error('La pantalla no alcanzó el estado esperado')}
function command(method,params={}){const n=++id;return new Promise((resolve,reject)=>{pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))})}
async function evaluate(expression){const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text);return r.result.value}
try{
 await until(async()=>{try{return(await fetch('http://127.0.0.1:9338/json/version')).ok}catch{return false}})
 const tab=await(await fetch(`http://127.0.0.1:9338/json/new?${encodeURIComponent(base)}`,{method:'PUT'})).json()
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
 const actual=await(await fetch(base+'/api/v1/analisis/base-financiera',{headers})).json()
 assert.equal(actual.periodo.estado,'PROVISIONAL')
 const completo=await(await fetch(base+'/api/v1/analisis/base-financiera?soloCompletos=1',{headers})).json()
 assert.equal(completo.periodo.completo,true)
 assert.ok(completo.anio<actual.anio)
 await command('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('analisis_token',${JSON.stringify(token)});sessionStorage.setItem('analisis_user',${JSON.stringify(JSON.stringify(user))});sessionStorage.setItem('analisis_last_activity',String(Date.now()));`})
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false})
 await command('Page.navigate',{url:base+'/dashboard'})
 await until(()=>evaluate("document.body.innerText.includes('An\u00e1lisis preliminar')&&Boolean(document.querySelector('[aria-label=\"Cifras principales\"]'))"))
 await until(()=>evaluate("document.querySelectorAll('.recharts-wrapper').length===2"))
 writeFileSync(resolve(output,'analisis-preliminar.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'))
 await command('Page.navigate',{url:base+'/proyecciones/pronostico'})
 await until(()=>evaluate("document.body.innerText.includes('A\u00f1os excluidos')&&document.querySelectorAll('tbody tr').length>0"))
 assert.equal(await evaluate("document.querySelector('tbody tr td').innerText"),String(completo.anio+1))
 writeFileSync(resolve(output,'pronostico-completo.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'))
 await command('Page.navigate',{url:base+'/proyecciones/proforma'})
 await until(()=>evaluate("Boolean(document.querySelector('[data-proforma-report]'))"))
 assert.equal(await evaluate("document.querySelector('select').value"),String(completo.anio))
 assert.equal(await evaluate(`Boolean([...document.querySelector('select').options].find(o=>o.value==='${actual.anio}'))`),false)
 await command('Page.navigate',{url:base+'/analisis/dupont'})
 await until(()=>evaluate("document.body.innerText.includes('An\u00e1lisis preliminar')"))
 await command('Page.navigate',{url:base+'/ratios'})
 await until(()=>evaluate("document.body.innerText.includes('An\u00e1lisis preliminar')"))
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await evaluate("window.dispatchEvent(new Event('resize'))")
 await until(()=>evaluate("document.querySelector('aside').getBoundingClientRect().right<=1"))
 await command('Page.navigate',{url:base+'/dashboard'})
 await until(()=>evaluate("document.body.innerText.includes('An\u00e1lisis preliminar')&&Boolean(document.querySelector('[aria-label=\"Cifras principales\"]'))"))
 assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true)
 writeFileSync(resolve(output,'analisis-movil.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'))
 assert.deepEqual(errors,[])
 console.log('PASS: ANF abierto disponible; aviso preliminar en dashboard, DuPont y Ratios; anual excluye el abierto; Proforma usa el ultimo completo; movil sin desborde. Sin escrituras ni IA.')
}finally{
 if(ws?.readyState===WebSocket.OPEN){try{await command('Browser.close')}catch{}ws.close()}browser.kill()
}
