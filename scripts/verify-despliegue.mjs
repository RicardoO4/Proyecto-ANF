// Default: public GETs. --autenticado: one explicitly authorized login, then GETs.
// No Gemini calls or business writes in either mode.
import assert from 'node:assert/strict'
const base = process.env.E2E_BASE_URL ?? 'https://proyecto-anf.vercel.app'
let fallos = 0
let token
async function comprobar(path, esperado = 200) {
  const inicio = Date.now()
  const response = await fetch(base + path, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(90_000),
  })
  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json') ? await response.json() : await response.text()
  const ok = response.status === esperado
  if (!ok) fallos++
  console.log(JSON.stringify({ resultado: ok ? 'PASS' : 'FAIL', path, status: response.status, ms: Date.now() - inicio, ...(Array.isArray(data) ? { registros: data.length } : {}), ...(!ok && typeof data === 'object' ? { mensaje: data?.message } : {}) }))
  return { response, data }
}
await comprobar('/')
await comprobar('/api/v1/inventarios', 401)
for (const path of ['/api/v1/empresas/principal', '/api/v1/analisis/base-financiera', '/api/v1/presupuestos', '/api/v1/evaluaciones-capital', '/api/v1/ventas-historicas/pronostico', '/api/v1/analisis/asistente-ia', '/api/v1/ratios']) await comprobar(path, 401)
for (const path of ['/analisis/dupont', '/proyecciones/pronostico', '/proyecciones/proforma', '/proyecciones/presupuestos', '/proyecciones/capital', '/inventarios']) {
  await comprobar(path)
}
await comprobar('/templates/ejemplo_estados_2020.xlsx')
if (process.argv.includes('--autenticado')) {
  assert.ok(process.env.E2E_USER && process.env.E2E_PASSWORD, 'Configure E2E_USER y E2E_PASSWORD y autorice el acceso al destino antes de usar --autenticado.')
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: process.env.E2E_USER, contrasena: process.env.E2E_PASSWORD }),
    signal: AbortSignal.timeout(30_000),
  })
  const sesion = await login.json()
  console.log(JSON.stringify({ loginStatus: login.status }))
  assert.ok(login.ok && sesion.token, 'No se pudo iniciar sesión. No se intentan otras credenciales.')
  token = sesion.token
  const principal = await comprobar('/api/v1/empresas/principal')
  const empresaId = principal.data.empresaId
  assert.ok(empresaId, 'Falta empresa principal')
  const financiera = await comprobar('/api/v1/analisis/base-financiera')
  for (const grupo of [
    ['/api/v1/empresas', '/api/v1/sectores', '/api/v1/categorias-ratio'],
    ['/api/v1/tipos-ratio', '/api/v1/parametros-sector', '/api/v1/estados-financieros'],
    ['/api/v1/ratios', '/api/v1/inventarios', `/api/v1/presupuestos?empresaId=${empresaId}`],
    [`/api/v1/evaluaciones-capital?empresaId=${empresaId}`, `/api/v1/ventas-historicas/empresa/${empresaId}`, `/api/v1/analisis/asistente-ia?empresaId=${empresaId}`],
    ['/api/v1/ventas-historicas/pronostico?periodicidad=anual&periodos=3', `/api/v1/analisis/evolucion-ratios?empresaId=${empresaId}&ratios=ROA,ROE`],
  ]) {
    const resultados = await Promise.allSettled(grupo.map(path => comprobar(path)))
    resultados.forEach((r, i) => { if (r.status === 'rejected') { fallos++; console.log(JSON.stringify({ resultado: 'FAIL', path: grupo[i], error: r.reason.message })) } })
  }
  if (financiera.response.ok && financiera.data.anios?.length >= 2) {
    const anios = financiera.data.anios
    await comprobar(`/api/v1/analisis/reporte-interno?empresaId=${empresaId}&anio1=${anios[1]}&anio2=${anios[0]}`)
  }
}
console.log(JSON.stringify({ fallos, generaGemini: false, modificaDatosNegocio: false }))
process.exitCode = fallos ? 1 : 0
