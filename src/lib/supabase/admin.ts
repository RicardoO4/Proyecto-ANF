// Privileged (service-role) Supabase client used ONLY inside Route
// Handlers — bypasses Row Level Security, manages auth.users as admin.
// Keep it out of any client component.
//
// The client is created lazily on first property access so that importing
// this module never throws at build time (Next.js evaluates route modules
// while collecting page data, where env vars may not be set).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instance: SupabaseClient | null = null

function getInstance(): SupabaseClient {
  if (!instance) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Supabase no está configurado: define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local',
      )
    }
    instance = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }
  return instance
}

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getInstance(), prop, receiver)
  },
})
