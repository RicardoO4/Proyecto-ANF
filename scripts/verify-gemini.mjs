// Explicit, bounded live test: at most ONE generation request reaches Google.
// Uses anonymous calculator inputs; never prints credentials or retries generation.
import nextEnv from '@next/env'
import assert from 'node:assert/strict'
nextEnv.loadEnvConfig(process.cwd())
const key = process.env.GEMINI_API_KEY
assert.ok(key, 'Falta GEMINI_API_KEY en .env.local')
const redact = value => String(value).replaceAll(key, '[clave oculta]')
const originalFetch = globalThis.fetch
const originalError = console.error, originalWarn = console.warn
console.error = (...args) => originalError(...args.map(redact))
console.warn = (...args) => originalWarn(...args.map(redact))
let generaciones = 0, bloqueadas = 0, estadoGoogle = null, mensajeGoogle = ''
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href)
  if (url.hostname.endsWith('googleapis.com')) {
    if (!url.pathname.includes(':generateContent')) throw new Error('Petición a Google fuera de esta prueba.')
    if (generaciones >= 1) { bloqueadas++; throw new Error('Reintento bloqueado: límite de una generación por prueba.') }
    generaciones++
    const response = await originalFetch(input, init)
    estadoGoogle = response.status
    if (!response.ok) {
      const data = await response.clone().json().catch(() => null)
      mensajeGoogle = redact(data?.error?.message ?? '')
    }
    return response
  }
  throw new Error('La prueba de Gemini no necesita ninguna otra conexión externa.')
}
try {
  const { resumirAnalisis } = await import('../src/lib/resumenIA.ts')
  const datos = { costosFijos: 1000, precioVenta: 20, costoVariable: 10 }
  const primera = await resumirAnalisis('equilibrio', datos)
  assert.equal(primera.desdeCache, false)
  assert.ok(primera.interpretacion.resumen.trim())
  const segunda = await resumirAnalisis('equilibrio', datos)
  assert.equal(segunda.desdeCache, true)
  assert.deepEqual(segunda.interpretacion, primera.interpretacion)
  assert.equal(segunda.generadoEn, primera.generadoEn)
  assert.equal(generaciones, 1)
  console.log(JSON.stringify({ resultado: 'PASS', modelo: primera.modelo, primeraDesdeCache: primera.desdeCache, segundaDesdeCache: segunda.desdeCache, generacionesHTTP: generaciones, tokensPrimera: primera.tokens, consumoAdicionalSegunda: 0, resumen: primera.interpretacion.resumen }))
} catch (error) {
  console.log(JSON.stringify({ resultado: 'FAIL', generacionesHTTP: generaciones, reintentosBloqueados: bloqueadas, estadoGoogle, mensajeGoogle, mensaje: redact(error instanceof Error ? error.message : 'Error de la prueba') }))
  process.exitCode = 1
} finally {
  globalThis.fetch = originalFetch
  console.error = originalError; console.warn = originalWarn
}
