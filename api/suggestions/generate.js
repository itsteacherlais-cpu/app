import { requireAuth } from '../_lib/auth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { getTrendingTopicsBR } from '../_lib/trends.js'
import { pickRandomIdea } from '../_lib/ideaTemplates.js'

// Data é decidida pelo cliente (fuso local dela), não pelo servidor — evita
// o mesmo tipo de descompasso de fuso horário já corrigido em outras telas.
function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export default requireAuth(async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' })
    return
  }

  const { date, force } = req.body || {}
  if (!isValidDateStr(date)) {
    res.status(400).json({ error: 'Parâmetro "date" inválido (esperado yyyy-MM-dd)' })
    return
  }

  const supabase = getSupabaseAdmin()

  if (!force) {
    const { data: existing } = await supabase
      .from('daily_suggestions')
      .select('items')
      .eq('user_id', req.user.id)
      .eq('suggestion_date', date)
      .maybeSingle()
    if (existing) {
      res.status(200).json({ items: existing.items, cached: true })
      return
    }
  }

  try {
    // 100% gratuito: temas reais do Google Trends (feed público, sem chave)
    // + ideias geradas por modelos de frase locais (sem chamada a nenhuma IA paga).
    const topics = await getTrendingTopicsBR(10)
    if (topics.length === 0) {
      throw new Error('Nenhum tema em alta encontrado agora, tenta de novo mais tarde')
    }

    const items = topics.map((topic) => ({ topic, idea: pickRandomIdea(topic) }))

    const { error: upsertError } = await supabase
      .from('daily_suggestions')
      .upsert(
        { user_id: req.user.id, suggestion_date: date, items },
        { onConflict: 'user_id,suggestion_date' }
      )
    if (upsertError) throw upsertError

    res.status(200).json({ items, cached: false })
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})
