import { createClient } from '@supabase/supabase-js'

let client

export function getSupabaseAdmin() {
  if (!client) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        'Configuração ausente no servidor: SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY não estão definidas ' +
          'nas variáveis de ambiente da Vercel (Project Settings > Environment Variables).'
      )
    }
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  }
  return client
}
