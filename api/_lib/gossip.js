// Busca manchetes de fofoca/entretenimento (famosos, filmes, séries, música,
// polêmicas) em sites gratuitos dos EUA e da Europa, via RSS público — sem
// chave de API. Cada feed é tentado de forma independente: se algum estiver
// fora do ar, os outros seguem funcionando.
const GOSSIP_RSS_FEEDS = [
  'https://www.tmz.com/rss.xml',
  'https://pagesix.com/feed/',
  'https://people.com/feed/',
  'https://www.justjared.com/feed/',
  'https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml',
  'https://www.dailymail.co.uk/tvshowbiz/index.rss',
  'https://www.thesun.co.uk/tvandshowbiz/feed/',
  'https://ew.com/feed/',
]

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function parseRssItems(xml) {
  const itemBlocks = xml.split('<item>').slice(1)
  return itemBlocks
    .map((block) => {
      const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)
      const linkMatch = block.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s)
      const title = titleMatch ? titleMatch[1].trim() : null
      const link = linkMatch ? linkMatch[1].trim() : null
      return title && link ? { title, link } : null
    })
    .filter(Boolean)
}

async function fetchFeedItems(url) {
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': BROWSER_USER_AGENT } })
    if (!resp.ok) return []
    return parseRssItems(await resp.text())
  } catch {
    return []
  }
}

function shuffle(list) {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function getCelebGossipHeadlines(limit = 3) {
  const perFeed = await Promise.all(GOSSIP_RSS_FEEDS.map(fetchFeedItems))
  const all = perFeed.flat()
  const seenTitles = new Set()
  const unique = all.filter((item) => {
    if (seenTitles.has(item.title)) return false
    seenTitles.add(item.title)
    return true
  })
  if (unique.length === 0) {
    throw new Error('Não encontramos fofocas agora, tenta de novo mais tarde')
  }
  return shuffle(unique).slice(0, limit)
}
