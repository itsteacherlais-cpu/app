import Anthropic from '@anthropic-ai/sdk'
import { requireAuth } from '../_lib/auth.js'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js'
import { getTrendingTopicsBR } from '../_lib/trends.js'

const SUGGESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          idea: { type: 'string' },
        },
        required: ['topic', 'idea'],
        additionalProperties: false,
      },
    },
  },
  required: ['suggestions'],
  additionalProperties: false,
}

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
    const topics = await getTrendingTopicsBR(15)
    if (topics.length === 0) {
      throw new Error('Nenhum tema em alta encontrado agora, tenta de novo mais tarde')
    }

    const anthropic = new Anthropic()
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2048,
      system:
        'Você ajuda a Teacher Laís, professora de inglês (aulas particulares) e criadora de ' +
        'conteúdo sobre inglês no YouTube/Instagram/TikTok, a conectar assuntos em alta no ' +
        'Brasil com ideias de conteúdo educacional sobre inglês.',
      messages: [
        {
          role: 'user',
          content:
            `Temas em alta hoje no Brasil (Google Trends):\n${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` +
            'Escolha até 10 desses temas e, para cada um, sugira uma ideia curta e prática de ' +
            'conteúdo (vídeo ou post) conectando o tema ao ensino de inglês — por exemplo, ' +
            'vocabulário relacionado, expressões/gírias em inglês sobre o assunto, ou como usar ' +
            'o tema pra ensinar uma estrutura gramatical específica. Seja específica e criativa, ' +
            'evite ideias genéricas tipo "fale sobre X em inglês".',
        },
      ],
      output_config: { format: { type: 'json_schema', schema: SUGGESTIONS_SCHEMA } },
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock) throw new Error('Resposta vazia da IA')
    const parsed = JSON.parse(textBlock.text)
    const items = (parsed.suggestions || []).slice(0, 10)

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
