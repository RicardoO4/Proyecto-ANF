// Server-side Supabase client bound to the caller's Bearer token (JWT).
// Use this in Route Handlers when you need Row Level Security to apply
// to the calling user. For privileged operations use admin.ts.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

/**
 * Creates a Supabase client that executes every database/auth call with
 * the JWT supplied by the client (Authorization: Bearer <token>).
 */
export function createAuthedClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/** Reads the access token from an incoming Request, if any. */
export function getTokenFromRequest(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}
