import nextEnv from '@next/env'
import { spawn } from 'node:child_process'
nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} })
const target = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
if (!['127.0.0.1','localhost','[::1]'].includes(target.hostname)) throw new Error('dev:local requiere npm run db:env. Se rechazó la conexión remota.')
const child = spawn(process.execPath,['node_modules/next/dist/bin/next','dev',...process.argv.slice(2)],{
  stdio:'inherit',windowsHide:true,env:{...process.env,ANF_LOCAL_ONLY:'1'},
})
child.on('exit',code=>{process.exitCode=code ?? 1})
