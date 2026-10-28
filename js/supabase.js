import { config } from '../config.js'

const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm'

export const demo = !!config.demo
export const configured = demo || !!(config.supabaseUrl && config.supabaseAnonKey)

// PKCE puts the login code in ?code=, so it never collides with the #/ routes.
// The library is loaded only when it is needed (not in demo mode).
export const supabase = !demo && configured
  ? (await import(SUPABASE_JS)).createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  : null
