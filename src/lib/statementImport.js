import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

// Reconstrói as linhas do PDF pela posição real de cada texto na página
// (coordenadas x/y), não pela ordem em que foi desenhado no arquivo. Extratos
// em tabela costumam ter colunas (data/descrição vs valor) desenhadas fora de
// ordem no conteúdo interno do PDF — agrupar por posição evita que isso
// bagunce a leitura.
async function extractRowsFromPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const rows = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const items = content.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] }))

    const buckets = []
    for (const item of items) {
      let bucket = buckets.find((b) => Math.abs(b.y - item.y) < 3)
      if (!bucket) {
        bucket = { y: item.y, items: [] }
        buckets.push(bucket)
      }
      bucket.items.push(item)
    }
    buckets.sort((a, b) => b.y - a.y)
    for (const bucket of buckets) {
      bucket.items.sort((a, b) => a.x - b.x)
      const line = bucket.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim()
      if (line) rows.push(line)
    }
  }
  return rows
}

function parseBRNumber(s) {
  if (!s) return null
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

const SUMMARY_BLOCK_START = /Saldo inicial dispon[ií]vel|Total de entradas/i
const SUMMARY_BLOCK_END = /^Transa[cç][õo]es$/i

const BOILERPLATE_ROW_PATTERNS = [
  /Cora SCFI/i,
  /Ouvidoria/i,
  /Extrato gerado/i,
  /^p[aá]g\.?\s*\d+\s*de\s*\d+/i,
  /Extrato do per[ií]odo/i,
  /^CNPJ\b/i,
  /^Ag[eê]ncia:/i,
  /^\d{2}\.\d{3}\.\d{3}\s/, // linha de cabeçalho "51.741.388 LAIS GONCALVES"
]

function isBoilerplateRow(row) {
  return BOILERPLATE_ROW_PATTERNS.some((re) => re.test(row))
}

// Extrai lançamentos do extrato em PDF do banco Cora. Cada linha, depois de
// reconstruída pela posição, deve conter data e/ou descrição e/ou o valor com
// sinal (+ entrada / - saída); acumula o que for aparecendo até fechar um
// lançamento quando encontra um valor.
export function parseCoraStatementRows(rows) {
  const transactions = []
  let pending = { date: null, description: '' }
  let inSummaryBlock = false

  for (const rawRow of rows) {
    if (SUMMARY_BLOCK_START.test(rawRow)) {
      inSummaryBlock = true
      // descarta qualquer texto solto acumulado antes do bloco de resumo
      // (ex.: o intervalo de datas do cabeçalho "de X a Y"), que não é
      // descrição de nenhum lançamento real.
      pending = { date: null, description: '' }
    }
    if (inSummaryBlock) {
      if (SUMMARY_BLOCK_END.test(rawRow.trim())) inSummaryBlock = false
      continue
    }
    if (isBoilerplateRow(rawRow)) continue

    let row = rawRow.replace(/Saldo do dia\s*R\$\s*[\d.,]+/i, '').trim()

    const amountMatch = row.match(/([+-])\s*R\$\s*([\d.,]+)/)
    if (amountMatch) row = row.replace(amountMatch[0], '').trim()

    const dateMatch = row.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    if (dateMatch) {
      pending.date = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
      row = row.replace(dateMatch[0], '').trim()
    }

    if (row) {
      pending.description = pending.description ? `${pending.description} ${row}`.trim() : row
    }

    if (amountMatch) {
      transactions.push({
        date: pending.date,
        description: pending.description || '(confira — descrição não identificada)',
        type: amountMatch[1] === '+' ? 'income' : 'expense',
        amount: parseBRNumber(amountMatch[2]),
      })
      pending = { date: pending.date, description: '' }
    }
  }

  return transactions.filter((t) => t.amount != null)
}

export async function extractCoraStatement(file) {
  const rows = await extractRowsFromPdf(file)
  return parseCoraStatementRows(rows)
}
