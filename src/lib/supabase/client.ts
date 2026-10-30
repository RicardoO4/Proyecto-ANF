// Browser-side Supabase client (used only for optional direct reads;
// all core operations go through the app's API routes).
//
// Lazy creation so importing this module is safe even when the env vars
// are missing (e.g. static prerendering).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instance: SupabaseClient | null = null

function getInstance(): SupabaseClient {
  if (!instance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        'Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local',
      )
    }
    instance = createClient(supabaseUrl, supabaseAnonKey)
  }
  return instance
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver)
  },
})
