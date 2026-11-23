// Cuenta de prueba exclusiva del Supabase local. Nunca cambia usuarios existentes.
import nextEnv from '@next/env'
import {createClient} from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
nextEnv.loadEnvConfig(process.cwd(),true,{info(){},error(){}})
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Solo se permite Supabase local.')
const db=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
const {data:existing,error:readError}=await db.from('usuario').select('usuario_id,rol').eq('user_name','contador').maybeSingle()
if(readError)throw readError
if(existing){console.log(`El usuario contador ya existe (${existing.rol}); no se modificó su contraseña ni sus permisos.`)}
else{
 const {data,error}=await db.auth.admin.createUser({email:'contador@anf.local',password:'Contador123!',email_confirm:true})
 if(error)throw error
 const {error:insertError}=await db.from('usuario').insert({nombre_usuario:'Contador',apellido_usuario:'Local',user_name:'contador',contrasena:bcrypt.hashSync('Contador123!',10),rol:'CONTADOR',auth_user_id:data.user.id})
 if(insertError){await db.auth.admin.deleteUser(data.user.id);throw insertError}
 console.log('Creado contador / Contador123! exclusivamente en Supabase local, con acceso al ciclo contable completo.')
}
