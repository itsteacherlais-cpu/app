// Busca os temas em alta no Brasil hoje via o feed público (e gratuito) de
// tendências diárias do Google — não precisa de chave de API.
export async function getTrendingTopicsBR(limit = 15) {
  const resp = await fetch('https://trends.google.com/trends/trendingsearches/daily/rss?geo=BR', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TeacherLaisHQ/1.0)' },
  })
  if (!resp.ok) {
    throw new Error(`Falha ao buscar tendências do Google: ${resp.status}`)
  }
  const xml = await resp.text()
  const itemBlocks = xml.split('<item>').slice(1)
  const topics = itemBlocks
    .map((block) => {
      const match = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)
      return match ? match[1].trim() : null
    })
    .filter(Boolean)
  return topics.slice(0, limit)
}
