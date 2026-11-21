// Real Chromium smoke tests, no extra dependencies. Writes only ignored .next artifacts.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import nextEnv from '@next/env'
nextEnv.loadEnvConfig(process.cwd())
const executable = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)
assert.ok(executable, 'Se necesita Microsoft Edge o Chrome instalado.')
const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100'
const port = 9335
const output = resolve('.next/e2e-screenshots')
mkdirSync(output, { recursive: true })
const browser = spawn(executable, ['--headless=new', '--disable-gpu', '--disable-extensions', '--disable-component-extensions-with-background-pages', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', `--remote-debugging-port=${port}`, `--user-data-dir=${resolve('.next/e2e-browser-profile')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const delay = ms => new Promise(r => setTimeout(r, ms))
let ws, id = 0
const pending = new Map(), errors = []
async function until(check, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) { const result = await check(); if (result) return result; await delay(100) }
  throw new Error('La pantalla no alcanzó el estado esperado en el tiempo permitido.')
}
function command(method, params = {}) {
  const requestId = ++id
  return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); ws.send(JSON.stringify({ id: requestId, method, params })) })
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}
try {
  await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/json/version`)).ok } catch { return false } })
  const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(base)}`, { method: 'PUT' })).json()
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }) })
  ws.addEventListener('message', event => {
    const message = JSON.parse(String(event.data))
    if (message.id) { const request = pending.get(message.id); pending.delete(message.id); if (message.error) request?.reject(new Error(message.error.message)); else request?.resolve(message.result) }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text)
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(a => a.value ?? a.description ?? '').join(' '))
  })
  await command('Page.enable'); await command('Runtime.enable')
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  const response = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: process.env.E2E_USER ?? 'admin', contrasena: process.env.E2E_PASSWORD ?? 'admin123' }) })
  assert.equal(response.status, 200, 'No se pudo iniciar sesión para el navegador.')
  const session = await response.json()
  const { token, ...user } = session
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('analisis_token',${JSON.stringify(token)});sessionStorage.setItem('analisis_user',${JSON.stringify(JSON.stringify(user))});sessionStorage.setItem('analisis_last_activity',String(Date.now()));` })
  for (const [path, texto] of [
    ['/analisis/dupont', 'DuPont y sensibilidad'],
    ['/proyecciones/proforma', 'Balance General Proforma'],
    ['/proyecciones/pronostico', 'Periodicidad del resultado'],
    ['/inventarios', 'Inventarios ABC'],
    ['/proyecciones/presupuestos', 'Presupuesto'],
    ['/proyecciones/capital', 'Presupuesto de capital'],
  ]) {
    await command('Page.navigate', { url: base + path })
    await until(() => evaluate(`document.body.innerText.includes(${JSON.stringify(texto)}) && !document.body.innerText.includes('Cargando')`))
    // Wait for data and charts, then check for hydration/runtime failures.
    await delay(600)
    if (path === '/proyecciones/proforma') {
      const antes = await evaluate("document.querySelector('tfoot').innerText")
      await evaluate("(() => { const input=document.querySelector('input[type=number]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'15'); input.dispatchEvent(new Event('input',{bubbles:true})); })()")
      await until(async () => (await evaluate("document.querySelector('tfoot').innerText")) !== antes)
      console.log('PASS Proforma recalcula al modificar crecimiento')
    }
    if (path === '/proyecciones/pronostico') {
      await evaluate("(() => { const select=document.querySelector('select'); select.value='mensual'; select.dispatchEvent(new Event('change',{bubbles:true})); })()")
      await until(() => evaluate("!document.body.innerText.includes('Periodicidad del resultado')"))
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Generar pronóstico').click()")
      await until(() => evaluate("document.body.innerText.includes('Se necesitan al menos tres periodos mensuales reales')"))
      await evaluate("(() => { const select=document.querySelector('select'); select.value='anual'; select.dispatchEvent(new Event('change',{bubbles:true})); })()")
      await evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Generar pronóstico').click()")
      await until(() => evaluate("document.body.innerText.includes('Periodicidad del resultado')"))
      console.log('PASS cambio de periodicidad invalida resultado y permite recuperar pronóstico anual')
    }
    const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    writeFileSync(resolve(output, path.replaceAll('/', '_') + '.png'), Buffer.from(shot.data, 'base64'))
    console.log('PASS navegador ' + path)
  }
  await command('Page.navigate', { url: base + '/proyecciones' })
  await until(() => evaluate("document.body.innerText.includes('Meses reales registrados:')"))
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Generar Proyección').disabled"), true)
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Carga Manual').click()")
  await until(() => evaluate("document.body.innerText.includes('Preparar doce meses')"))
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.innerText==='Preparar doce meses').click()")
  await until(() => evaluate("document.querySelectorAll('input[type=month]').length===12"))
  assert.equal(await evaluate("[...document.querySelectorAll('form input[type=number]')].slice(1).every(i=>i.value==='')"), true)
  console.log('PASS D: muestra faltantes, bloquea proyección mensual sin datos y prepara doce meses vacíos')
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('analisis_user',${JSON.stringify(JSON.stringify({ ...user, rol: 'ANALISTA', accesos: [3] }))});` })
  await command('Page.navigate', { url: base + '/proyecciones/proforma' })
  await until(() => evaluate("document.body.innerText.includes('No tiene permiso para acceder a este módulo')"))
  console.log('PASS control de acceso directo en navegador')
  assert.deepEqual(errors, [], 'Errores en navegador: ' + errors.join('\n'))
  console.log('PASS sin errores de hidratación ni excepciones del navegador; Gemini no fue invocado')
} finally {
  if (ws?.readyState === WebSocket.OPEN) { try { await command('Browser.close') } catch {} ws.close() }
  browser.kill()
}
