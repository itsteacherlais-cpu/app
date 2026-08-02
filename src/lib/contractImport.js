import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

export async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const pageTexts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    pageTexts.push(content.items.map((item) => item.str).join(' '))
  }
  return pageTexts.join('\n')
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Pega o texto entre "LABEL -" e o próximo "LABEL -" conhecido, no modelo de
// contrato "LABEL - valor" da Teacher Laís (linha reta, sem quebra).
function between(flatText, startLabel, endLabel) {
  const re = new RegExp(
    `${escapeRegex(startLabel)}\\s*-\\s*(.*?)\\s*${escapeRegex(endLabel)}\\s*-`,
    'i'
  )
  const m = flatText.match(re)
  return m ? m[1].trim() : ''
}

function toISODate(brDate) {
  const m = brDate && brDate.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

function parseBRNumber(s) {
  if (!s) return null
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// Extrai os dados do modelo de contrato "CONTRATO PARA AULAS PARTICULARES DE
// INGLÊS" da Teacher Laís: bloco de identificação em "LABEL - valor" e as
// cláusulas de duração/pagamento em texto corrido.
export function parseContractText(rawText) {
  const flat = rawText.replace(/\s+/g, ' ').trim()

  const name = between(flat, 'NOME CONTRATANTE', 'ENDEREÇO')
  const address = between(flat, 'ENDEREÇO', 'CEP')
  const cep = between(flat, 'CEP', 'TELEFONE')
  const whatsapp = between(flat, 'TELEFONE', 'CPF')
  const cpf = between(flat, 'CPF', 'RG')
  const rg = between(flat, 'RG', 'DATA DE NASCIMENTO')
  const birthDateBr = between(flat, 'DATA DE NASCIMENTO', 'EMAIL')
  const birth_date = toISODate(birthDateBr)

  const emailMatch = flat.match(/EMAIL\s*-\s*([^\s]+@[^\s.,;]+\.[^\s.,;]+)/i)
  const email = emailMatch ? emailMatch[1] : ''

  const classesMatch = flat.match(/(\d+)\s*encontros/i)
  const package_classes_total = classesMatch ? Number(classesMatch[1]) : null

  const durationMatch = flat.match(/per[ií]odo de\s*(\d+)\s*meses/i)
  const duration_months = durationMatch ? Number(durationMatch[1]) : null

  const vigenciaMatch = flat.match(
    /vig[eê]ncia de\s*(\d{2}\/\d{2}\/\d{4})\s*a\s*(\d{2}\/\d{2}\/\d{4})/i
  )
  const contract_start_date = vigenciaMatch ? toISODate(vigenciaMatch[1]) : ''
  const contract_end_date = vigenciaMatch ? toISODate(vigenciaMatch[2]) : ''

  const installmentMatch = flat.match(/valor de R\$\s*([\d.,]+)\s*com a primeira parcela/i)
  const rate_value = installmentMatch ? parseBRNumber(installmentMatch[1]) : null

  const dueDayMatch = flat.match(/dias\s*(\d{1,2})\s*de cada m[eê]s/i)
  const payment_due_day = dueDayMatch ? Number(dueDayMatch[1]) : null

  return {
    name,
    address,
    cep,
    whatsapp,
    cpf,
    rg,
    birth_date,
    email,
    package_classes_total,
    duration_months,
    contract_start_date,
    contract_end_date,
    rate_value,
    payment_due_day,
  }
}
