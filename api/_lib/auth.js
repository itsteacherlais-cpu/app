import { getSupabaseAdmin } from './supabaseAdmin.js'

/**
 * Valida o token Bearer (sessão do Supabase Auth) enviado pelo frontend.
 * Retorna o usuário autenticado ou null.
 */
export async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

export function requireAuth(handler) {
  return async (req, res) => {
    const user = await getAuthenticatedUser(req)
    if (!user) {
      res.status(401).json({ error: 'Não autenticado' })
      return
    }
    req.user = user
    return handler(req, res)
  }
}
