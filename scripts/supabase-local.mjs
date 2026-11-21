// Comandos deliberadamente locales: no aceptan --remote ni URLs externas.
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(root, 'node_modules/supabase/dist/supabase.js')
const env = { ...process.env }
const distro = process.env.ANF_WSL_DISTRO || 'Ubuntu-24.04'
const linuxRoot = root.replace(/\\/g,'/').replace(/^([A-Za-z]):/,(_,drive)=>`/mnt/${drive.toLowerCase()}`)
function engine(command,args,options={}) {
  return spawnSync(process.platform==='win32'?'wsl.exe':command,
    process.platform==='win32'?['-d',distro,'-u','root','--exec',command,...args]:args,
    {cwd:root,env,encoding:'utf8',windowsHide:true,...options})
}
const action = process.argv[2] ?? 'status'
if (process.argv.length > 3) throw new Error('No se admiten parámetros adicionales ni destinos remotos.')
function run(args, capture = false) {
  const options={stdio:capture?'pipe':'inherit',maxBuffer:10*1024*1024}
  const result = process.platform==='win32'
    ? engine('/usr/local/bin/supabase',[...args,'--workdir',linuxRoot,'--agent','no'],options)
    : spawnSync(process.execPath,[cli,...args,'--workdir',root,'--agent','no'],{cwd:root,env,encoding:'utf8',...options})
  if (result.error || result.status !== 0) throw new Error(capture ? 'Supabase local no está disponible. Inicie Docker y ejecute npm run db:start.' : 'Falló el comando local de Supabase.')
  return result.stdout
}
function localStatus() {
  const data = JSON.parse(run(['status', '-o', 'json'], true))
  // v2/v3: se normalizan los nombres exportados por status.
  const flat = Object.fromEntries(Object.entries(data).map(([k,v]) => [k.toUpperCase(),v]))
  const api = flat.API_URL ?? data.api?.url
  const db = flat.DB_URL ?? data.db?.url
  const anon = flat.ANON_KEY ?? data.api?.anon_key
  const service = flat.SERVICE_ROLE_KEY ?? data.api?.service_role_key
  for (const value of [api, db]) {
    if (!value || !['127.0.0.1','localhost','[::1]'].includes(new URL(value).hostname)) throw new Error('Se rechazó un destino que no es local.')
  }
  if (!anon || !service) throw new Error('No se encontraron las claves locales en supabase status.')
  return { api, db, anon, service }
}
async function seed() {
  const status = localStatus()
  const snapshotFile = resolve(root, '.local-data/anf-snapshot.json')
  if (!existsSync(snapshotFile)) throw new Error('Falta .local-data/anf-snapshot.json. Exporte primero el catálogo ANF con db:export.')
  const { tablas } = JSON.parse(readFileSync(snapshotFile, 'utf8'))
  const db = new pg.Client({ connectionString: status.db })
  await db.connect()
  try {
    await db.query('BEGIN')
    const used = await db.query("SELECT 1 FROM public.cont_periodo WHERE origen='CONTABILIDAD' LIMIT 1")
    if (used.rowCount) throw new Error('Ya hay ejercicios operativos. La carga inicial no sobrescribe contabilidad existente.')
    // Solo tablas explícitas, sin auth ni usuarios. Conserva el admin local del seed.
    const order = { sector:'id_sector', empresa:'empresa_id', cuenta:'cuenta_id', catalogo:'id_catalogo', tipo_ratio:'id_tipo_ratio', categoria_ratio:'id_categoria_ratio', parametro_sector:'id_parametro_sector', estado_financiero:'id_estado_financiero', linea_estado_financiero:'id_linea', ratio:'id_ratio', venta:'id_venta' }
    // Antes de importar históricos en Contabilidad, se puede repetir esta carga.
    const imported = await db.query('SELECT 1 FROM public.cont_periodo LIMIT 1')
    if (imported.rowCount) throw new Error('El histórico ya está incorporado. No se reemplaza una base de trabajo inicializada.')
    for (const table of Object.keys(order).reverse()) await db.query(`DELETE FROM public.${table}`)
    for (const [table,key] of Object.entries(order)) {
      const rows = tablas[table] ?? []
      if (rows.length) await db.query(`INSERT INTO public.${table} SELECT * FROM jsonb_populate_recordset(NULL::public.${table},$1::jsonb)`, [JSON.stringify(rows)])
      await db.query(`SELECT setval(pg_get_serial_sequence('public.${table}','${key}'),GREATEST(COALESCE((SELECT max(${key}) FROM public.${table}),1),1),true)`)
      console.log(`${table}: ${rows.length} registros locales`)
    }
    const admin=await db.query("SELECT usuario_id FROM usuario WHERE rol='ADMIN' ORDER BY usuario_id LIMIT 1")
    for(const empresa of tablas.empresa??[])await db.query("SELECT cont_operar($1,$2,'importar','{}')",[empresa.empresa_id,admin.rows[0].usuario_id])
    await db.query('COMMIT')
  } catch (error) { await db.query('ROLLBACK'); throw error } finally { await db.end() }
}
try {
  switch (action) {
    case 'start': case 'studio': {
      if(process.platform==='win32') {
        // systemd por sí solo no mantiene WSL activo cuando se cierra la terminal.
        const alive=engine('/usr/bin/pgrep',['-f','^anf-supabase-keepalive infinity$'],{stdio:'ignore'})
        if(alive.status!==0)spawn('wsl.exe',['-d',distro,'-u','root','--exec','/bin/bash','-c','exec -a anf-supabase-keepalive sleep infinity'],{detached:true,stdio:'ignore',windowsHide:true}).unref()
        const service=engine('/usr/sbin/service',['docker','start'],{stdio:'inherit'})
        if(service.status!==0)throw new Error('No se pudo iniciar Docker Engine en WSL.')
      }
      const inspect = engine('docker', ['network','inspect','anf-local'], {stdio:'ignore'})
      if (inspect.status !== 0) {
        const create = engine('docker', ['network','create','-o','com.docker.network.bridge.host_binding_ipv4=127.0.0.1','anf-local'], {stdio:'inherit'})
        if (create.status !== 0) throw new Error('No se pudo conectar con Docker Engine en WSL.')
      }
      const exclude=['realtime','storage-api','imgproxy','mailpit','edge-runtime','logflare','vector','supavisor']
      if(action==='studio')run(['stop'])
      if(action!=='studio')exclude.push('studio','postgres-meta')
      run(['start','--network-id','anf-local','--exclude',exclude.join(',')]); break
    }
    case 'stop': {
      run(['stop'])
      if(process.platform==='win32')engine('/usr/bin/pkill',['-f','^anf-supabase-keepalive infinity$'],{stdio:'ignore'})
      break
    }
    case 'status': {
      const s = localStatus(); console.log(`API local: ${s.api}\nStudio opcional: npm run db:studio\nLas claves no se muestran.`); break
    }
    case 'migrate': run(['migration','up']); break
    case 'seed': await seed(); break
    case 'history': {
      const s=localStatus(), db=new pg.Client({connectionString:s.db})
      await db.connect()
      try {
        const admin=(await db.query("SELECT usuario_id FROM usuario WHERE rol='ADMIN' ORDER BY usuario_id LIMIT 1")).rows[0]
        if(!admin)throw new Error('Falta el administrador local.')
        for(const row of (await db.query('SELECT empresa_id FROM empresa')).rows)await db.query("SELECT cont_operar($1,$2,'importar','{}')",[row.empresa_id,admin.usuario_id])
        console.log('Históricos locales incorporados. Se conservan BG, ER e indicadores.')
      } finally {await db.end()}
      break
    }
    case 'env': {
      const s = localStatus()
      const target = resolve(root,'.env.local')
      const previous = existsSync(target) ? readFileSync(target,'utf8') : ''
      const backup = resolve(root,'.env.remote-backup.local')
      if (previous && !existsSync(backup)) copyFileSync(target,backup)
      const values = { NEXT_PUBLIC_SUPABASE_URL:s.api, NEXT_PUBLIC_SUPABASE_ANON_KEY:s.anon, SUPABASE_SERVICE_ROLE_KEY:s.service, ANF_LOCAL_ONLY:'1' }
      let content = previous
      for (const [key,value] of Object.entries(values)) {
        const regex = new RegExp(`^${key}=.*$`,'m')
        content = regex.test(content) ? content.replace(regex,`${key}=${value}`) : `${content.trimEnd()}\n${key}=${value}\n`
      }
      writeFileSync(target,content,{mode:0o600})
      console.log('.env.local apunta a la base local. Respaldo privado: .env.remote-backup.local. Reinicie Next.js.'); break
    }
    default: throw new Error('Acción válida: start, studio, stop, status, migrate, seed o env.')
  }
} catch (error) { console.error(error.message); process.exitCode=1 }
