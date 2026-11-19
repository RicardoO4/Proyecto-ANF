// All HTTP is intercepted: no credentials, network, quota, or production writes.
import test from 'node:test'
import assert from 'node:assert/strict'
process.env.GEMINI_API_KEY = 'test-key-never-sent'
process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite'
let llamadas = 0, estado = 200
const respuesta = { estadoGeneral: 'atencion', resumen: 'Respuesta simulada', explicacionPorArea: [], puntosFuertes: [], alertas: [], recomendaciones: [], glosario: [] }
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? input.href)
  assert.equal(url.hostname, 'generativelanguage.googleapis.com')
  const body = JSON.parse(init.body)
  assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL')
  llamadas++
  await new Promise(resolve => setTimeout(resolve, 5))
  return new Response(JSON.stringify(estado === 200 ? {
    candidates: [{ content: { role: 'model', parts: [{ text: JSON.stringify(respuesta) }] }, finishReason: 'STOP' }],
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 30, totalTokenCount: 40 },
  } : { error: { code: estado, message: 'Fallo simulado', status: estado === 429 ? 'RESOURCE_EXHAUSTED' : 'UNAVAILABLE' } }), { status: estado, headers: { 'Content-Type': 'application/json' } })
}
const { interpretarConCache } = await import('../src/lib/iaComun.ts')
test('IA: consultas idénticas reutilizan respuesta sin otra llamada', async () => {
  const n = llamadas
  const a = await interpretarConCache('repeticion', 'mismos datos')
  const b = await interpretarConCache('repeticion', 'mismos datos')
  assert.equal(llamadas - n, 1)
  assert.equal(a.meta.desdeCache, false)
  assert.equal(b.meta.desdeCache, true)
  assert.deepEqual(a.interpretacion, b.interpretacion)
  assert.equal(a.meta.generadoEn, b.meta.generadoEn)
  assert.equal(b.meta.tokens.total, 40)
})
test('IA: peticiones simultáneas comparten una generación', async () => {
  const n = llamadas
  await Promise.all(Array.from({ length: 5 }, () => interpretarConCache('simultaneo', 'datos')))
  assert.equal(llamadas - n, 1)
})
test('IA: datos diferentes requieren respuestas diferentes', async () => {
  const n = llamadas
  await interpretarConCache('cambio', 'antes')
  await interpretarConCache('cambio', 'despues')
  assert.equal(llamadas - n, 2)
})
test('IA: regeneración protegida durante un minuto; expiración a seis horas', async () => {
  const original = Date.now
  let ahora = original()
  Date.now = () => ahora
  try {
    const n = llamadas
    await interpretarConCache('tiempo', 'datos')
    assert.equal((await interpretarConCache('tiempo', 'datos', true)).meta.desdeCache, true)
    ahora += 61_000
    assert.equal((await interpretarConCache('tiempo', 'datos', true)).meta.desdeCache, false)
    assert.equal((await interpretarConCache('tiempo', 'datos')).meta.desdeCache, true)
    ahora += 6 * 60 * 60 * 1000
    assert.equal((await interpretarConCache('tiempo', 'datos')).meta.desdeCache, false)
    assert.equal(llamadas - n, 3)
  } finally { Date.now = original }
})
test('IA: cuota y alta demanda no provocan reintentos automáticos ni quedan en caché', async () => {
  try {
    for (const codigo of [429, 503]) {
      estado = codigo
      const n = llamadas
      await assert.rejects(interpretarConCache(`error-${codigo}`, 'datos'))
      assert.equal(llamadas - n, 1)
      estado = 200
      assert.equal((await interpretarConCache(`error-${codigo}`, 'datos')).meta.desdeCache, false)
      assert.equal(llamadas - n, 2)
    }
  } finally { estado = 200 }
})
