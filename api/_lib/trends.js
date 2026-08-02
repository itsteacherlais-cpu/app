// Busca os temas em alta no Brasil hoje via o feed público (e gratuito) de
// tendências do Google — não precisa de chave de API. O Google já mudou o
// endereço desse feed antes, então tentamos o atual e, se falhar, o antigo.
const TRENDS_RSS_ENDPOINTS = [
  'https://trends.google.com/trending/rss?geo=BR',
  'https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR',
]

function parseTrendsRss(xml) {
  const itemBlocks = xml.split('<item>').slice(1)
  return itemBlocks
    .map((block) => {
      const match = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)
      return match ? match[1].trim() : null
    })
    .filter(Boolean)
}

export async function getTrendingTopicsBR(limit = 15) {
  let lastError = null
  for (const url of TRENDS_RSS_ENDPOINTS) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      })
      if (!resp.ok) {
        lastError = new Error(`Falha ao buscar tendências do Google: ${resp.status}`)
        continue
      }
      const topics = parseTrendsRss(await resp.text())
      if (topics.length > 0) return topics.slice(0, limit)
      lastError = new Error('Nenhum tema em alta encontrado no feed do Google Trends')
    } catch (err) {
      lastError = err
    }
  }
  throw lastError || new Error('Falha ao buscar tendências do Google')
}
