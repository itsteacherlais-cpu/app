// Modelos de ideia de conteúdo, sem IA paga: cada um vira uma sugestão ao
// preencher {topic} com um tema em alta do dia. Escolhido aleatoriamente por
// tema toda vez que as sugestões são geradas, então o mesmo tema pode dar
// ideias diferentes em dias/gerações diferentes.
export const IDEA_TEMPLATES = [
  'Monte um vídeo de vocabulário: liste 8-10 palavras em inglês relacionadas a "{topic}" e ensine a pronúncia de cada uma.',
  'Grave um short explicando 3 expressões idiomáticas em inglês que combinam com o tema "{topic}".',
  'Use "{topic}" como gancho pra ensinar um tempo verbal (ex.: past simple ou present perfect), contando a notícia em inglês.',
  'Faça uma enquete nos stories: "Como você diria isso sobre {topic} em inglês?" e responda no próximo post.',
  'Grave uma aula rápida de listening: leia uma manchete sobre "{topic}" em inglês e peça pros seguidores traduzirem nos comentários.',
  'Crie um post de pronúncia: quais palavras relacionadas a "{topic}" costumam ser mais difíceis de pronunciar em inglês?',
  'Compare uma gíria em português sobre "{topic}" com o equivalente em inglês (slang correspondente).',
  'Use "{topic}" pra ensinar 3 phrasal verbs relacionados ao assunto, com exemplo de frase pra cada um.',
  'Poste um "como se diz" rápido: pegue 5 termos específicos de "{topic}" e ensine a tradução certa (não a literal).',
  'Grave um vídeo comparando como "{topic}" seria comentado em inglês americano vs. britânico (vocabulário/expressões diferentes).',
  'Crie um quiz de múltipla escolha sobre vocabulário de "{topic}" em inglês pra engajamento nos stories.',
  'Explique 2-3 falsos cognatos (false friends) que podem aparecer ao falar sobre "{topic}" em inglês.',
  'Monte um roteiro de "read the news in English": resuma em 1 parágrafo simples, em inglês, o assunto "{topic}".',
  'Ensine como dar opinião em inglês usando "{topic}" como exemplo (structures: "In my opinion...", "I believe that...").',
  'Crie conteúdo sobre conectores/linking words usando frases sobre "{topic}" como exemplo prático.',
  'Reaja em inglês à fofoca "{topic}", ensinando expressões de reação (ex.: "I can\'t believe...", "No way!", "I was shocked when...").',
  'Conte "{topic}" em inglês como se fosse fofoca pra uma amiga, ensinando gírias de gossip (ex.: "spill the tea", "I heard that...", "rumor has it...").',
  'Traduza e explique 3 palavras/expressões específicas usadas nas manchetes internacionais sobre "{topic}".',
]

export function pickRandomIdea(topic) {
  const template = IDEA_TEMPLATES[Math.floor(Math.random() * IDEA_TEMPLATES.length)]
  return template.replace('{topic}', topic)
}
