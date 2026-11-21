// Real Chromium smoke tests, no extra dependencies. Writes only ignored .next artifacts.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
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
  // Mock ONLY the recalculation POST so this browser check never changes real years.
  // The SQL implementation is separately exercised with isolated fixtures.
  const peticiones = []
  let lecturas = 0
  await command('Network.enable')
  ws.addEventListener('message', async event => {
    const message = JSON.parse(String(event.data))
    if (message.method === 'Network.requestWillBeSent') {
      const req = message.params.request
      if (req.method === 'GET' && new URL(req.url).pathname === '/api/v1/ratios') lecturas++
    }
    if (message.method === 'Fetch.requestPaused') {
      const req = message.params.request
      peticiones.push(JSON.parse(req.postData))
      const forzar = peticiones.at(-1).forzar
      await delay(100)
      await command('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify({ calculados: forzar ? 23 : 0, omitidos: forzar ? 46 : 69, avisos: [] })).toString('base64') })
    }
  })
  await command('Fetch.enable', { patterns: [{ urlPattern: '*api/v1/ratios/recalcular', requestStage: 'Request' }] })
  await command('Page.navigate', { url: base + '/ratios' })
  const boton = "[...document.querySelectorAll('button')].find(b=>b.innerText==='Actualizar indicadores')"
  await until(() => evaluate(`Boolean(${boton}) && !${boton}.disabled && document.querySelectorAll('tbody tr').length>0`))
  const antes = lecturas
  await evaluate(`${boton}.click()`)
  await until(() => evaluate("document.body.innerText.includes('Los indicadores ya están actualizados')"))
  assert.equal(peticiones[0].forzar, false)
  assert.equal(lecturas, antes, 'Una verificación sin cambios no debe recargar toda la tabla')
  await evaluate("document.querySelector('input[type=checkbox]').click()")
  await evaluate(`${boton}.click()`)
  await until(() => evaluate("document.body.innerText.includes('23 indicadores actualizados')"))
  assert.equal(peticiones[1].forzar, true)
  assert.ok(lecturas > antes)
  assert.deepEqual(errors, [])
  console.log('PASS navegador: omisión muestra aviso sin recargar tabla; forzado envía true y refresca resultados')
  console.log('POST de recálculo simulado; GET y login locales reales; sin Gemini ni escrituras de negocio')
} finally {
  if (ws?.readyState === WebSocket.OPEN) { try { await command('Browser.close') } catch {} ws.close() }
  browser.kill()
}
