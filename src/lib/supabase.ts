import { createClient } from '@supabase/supabase-js'

// A chave sb_publishable é pública. Nunca substitua por service_role/secret.
// Variáveis de ambiente podem sobrescrever estes valores no deploy.
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || 'https://hfxakwkmitmjvmzzyytq.supabase.co'
const supabasePublishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  || 'sb_publishable_tofiVo5r1LsYmTJTsoVXmg_TkBPjj5j'

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
