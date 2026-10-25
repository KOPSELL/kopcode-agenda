import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

// No secret/service_role key may ever be placed in this browser client.
export const supabase = createClient(
  supabaseUrl || 'https://hfxakwkmitmjvmzzyytq.supabase.co',
  supabasePublishableKey || 'sb_publishable_not_configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
