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
const output=resolve('.local-data/e2e-proyecciones');mkdirSync(output,{recursive:true})
const browser=spawn(executable,['--headless=new','--disable-gpu','--disable-extensions','--disable-background-networking','--no-first-run','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9336',`--user-data-dir=${resolve('.local-data/proyecciones-browser-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let ws,id=0
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

 const injection=await command('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('analisis_token',${JSON.stringify(token)});sessionStorage.setItem('analisis_user',${JSON.stringify(JSON.stringify(user))});sessionStorage.setItem('analisis_last_activity',String(Date.now()));`})
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 await command('Page.navigate',{url:base+'/proyecciones/historial'})
 await until(()=>evaluate("Boolean(document.querySelector('[aria-label=\"Navegación de proyecciones\"]'))"))
 const paths=['pronostico','proforma','presupuestos','capital','cargar','historial']
 for(const path of paths){
  await evaluate(`document.querySelector('[aria-label="Navegación de proyecciones"] a[href="/proyecciones/${path}"]').click()`)
  await until(()=>evaluate(`location.pathname==='/proyecciones/${path}'&&document.querySelector('[aria-label="Navegación de proyecciones"] a[aria-current="page"]')?.getAttribute('href')==='/proyecciones/${path}'`))
  assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Navegación de proyecciones\"]').length"),1)
  assert.equal(await evaluate("document.querySelectorAll('[aria-label=\"Navegación de proyecciones\"] a').length"),6)
 }
 await evaluate("document.querySelector('a[href=\"/proyecciones/proforma\"]').click()")
 await until(()=>evaluate("Boolean(document.querySelector('[data-proforma-report]'))"))
 await evaluate("(()=>{const select=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='2025'));select.value='2025';select.dispatchEvent(new Event('change',{bubbles:true}));})()")
 await until(()=>evaluate("document.querySelector('[data-proforma-report] h2')?.innerText.includes('2026')&&!document.body.innerText.includes('Cargando estados financieros')"))
 await evaluate("window.scrollTo(0,1200)")
 await delay(150)
 const position=await evaluate("document.querySelector('[data-projection-navigation]').getBoundingClientRect().top")
 assert.ok(position>=0&&position<30,'El menú debe seguir visible al desplazarse: '+position)
 await evaluate("document.querySelector('a[href=\"/proyecciones/pronostico\"]').click()")
 await until(()=>evaluate("location.pathname==='/proyecciones/pronostico'&&window.scrollY===0"))
 await command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
 await evaluate("window.dispatchEvent(new Event('resize'))")
 await until(()=>evaluate("document.querySelector('aside').getBoundingClientRect().right<=1"))
 await evaluate("document.querySelector('a[href=\"/proyecciones/proforma\"]').click()")
 await until(()=>evaluate("Boolean(document.querySelector('[data-proforma-report]'))"))
 await until(()=>evaluate("(()=>{const nav=document.querySelector('[aria-label=\"Navegación de proyecciones\"]');const a=nav.querySelector('[aria-current=page]');const n=nav.getBoundingClientRect(),r=a.getBoundingClientRect();return location.pathname==='/proyecciones/proforma'&&r.left>=n.left&&r.right<=n.right})()"))
 writeFileSync(resolve(output,'navegacion-movil.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'))
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
 await evaluate("(()=>{const select=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='2025'));select.value='2025';select.dispatchEvent(new Event('change',{bubbles:true}));})()")
 await until(()=>evaluate("document.querySelector('[data-proforma-report] h2')?.innerText.includes('2026')&&!document.body.innerText.includes('Cargando estados financieros')"))
 const expectedRows=await evaluate("document.querySelectorAll('[data-proforma-report] tbody tr').length")
 const lastTotal=await evaluate("document.querySelector('[data-proforma-report] table[data-balance] tfoot tr:last-child').innerText")
 await evaluate(`(()=>{window.__reportPrint=null;const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.tagName==='IFRAME'&&node.title==='Vista de impresión del reporte'){node.addEventListener('load',()=>{node.contentWindow.print=()=>{window.__reportPrint=node.contentDocument.documentElement.outerHTML}},{once:true});}});observer.observe(document.body,{childList:true});})()`)
 await click('Imprimir / guardar PDF')
 await until(()=>evaluate("typeof window.__reportPrint==='string'"))
 const html=await evaluate("window.__reportPrint")
 writeFileSync(resolve(output,'proforma-2026.html'),html)
 await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier})
 await command('Page.navigate',{url:'about:blank'})
 const tree=await command('Page.getFrameTree')
 await command('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html})
 await command('Emulation.setEmulatedMedia',{media:'print'})
 await command('Emulation.setDeviceMetricsOverride',{width:1032,height:1000,deviceScaleFactor:1,mobile:false})
 assert.equal(await evaluate("document.querySelectorAll('aside,nav,input,select,button').length"),0)
 assert.equal(await evaluate("document.querySelectorAll('tbody tr').length"),expectedRows)
 assert.equal(await evaluate("document.querySelector('table[data-balance] tfoot tr:last-child').innerText"),lastTotal)
 assert.equal(await evaluate("getComputedStyle(document.querySelector('header')).display"),'block')
 assert.equal(await evaluate("getComputedStyle(document.body).color"),'rgb(17, 17, 17)')
 assert.equal(await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),true)
 writeFileSync(resolve(output,'reporte-impresion.png'),Buffer.from((await command('Page.captureScreenshot',{format:'png'})).data,'base64'))
 const pdf=await command('Page.printToPDF',{printBackground:true,displayHeaderFooter:false,preferCSSPageSize:true})
 const bytes=Buffer.from(pdf.data,'base64')
 writeFileSync(resolve(output,'proforma-2026.pdf'),bytes)
 const pages=(bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length
 assert.ok(pages>0)
 assert.deepEqual(errors,[])
 console.log(`PASS: seis rutas con navegación compartida, menú visible al desplazar, opción activa en móvil y PDF A4 horizontal de ${pages} páginas con ${expectedRows} filas, cifras intactas y sin interfaz. Sin IA ni escrituras.`)
}finally{
 if(ws?.readyState===WebSocket.OPEN){try{await command('Browser.close')}catch{}ws.close()}browser.kill()
}

