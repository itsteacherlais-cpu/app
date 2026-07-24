import { parseISO } from 'date-fns'

// Usamos parseISO (não `new Date(string)`) porque strings de data "pura"
// vindas do Postgres (ex.: "2026-07-24", sem horário) são interpretadas
// pelo `new Date()` nativo como UTC, o que pode "voltar" um dia em
// fusos negativos como o do Brasil. parseISO interpreta esse formato
// no horário local, e continua correto para timestamps completos
// (com hora e timezone, ex.: scheduled_at).
export function formatCurrency(value) {
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(dateStr, opts) {
  if (!dateStr) return ''
  const d = parseISO(dateStr)
  return d.toLocaleDateString('pt-BR', opts)
}

export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = parseISO(dateStr)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = parseISO(dateStr)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Livre']

export const STUDENT_STATUS = {
  active: { label: 'Ativo', className: 'bg-emerald-50 text-emerald-700' },
  inactive: { label: 'Inativo', className: 'bg-slate-100 text-slate-500' },
}

export const CLASS_STATUS = {
  scheduled: { label: 'Agendada', className: 'bg-blue-50 text-blue-700' },
  completed: { label: 'Realizada', className: 'bg-emerald-50 text-emerald-700' },
  canceled: { label: 'Cancelada', className: 'bg-red-50 text-red-700' },
  rescheduled: { label: 'Remarcada', className: 'bg-amber-50 text-amber-700' },
}

export const PAYMENT_STATUS = {
  paid: { label: 'Pago', className: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Pendente', className: 'bg-amber-50 text-amber-700' },
  late: { label: 'Atrasado', className: 'bg-red-50 text-red-700' },
}

export const CONTENT_STATUS_ORDER = ['idea', 'script', 'recording', 'editing', 'published']

export const CONTENT_STATUS = {
  idea: { label: 'Ideia', className: 'bg-slate-100 text-slate-600' },
  script: { label: 'Roteiro', className: 'bg-blue-50 text-blue-700' },
  recording: { label: 'Gravação', className: 'bg-violet-50 text-violet-700' },
  editing: { label: 'Edição', className: 'bg-amber-50 text-amber-700' },
  published: { label: 'Publicado', className: 'bg-emerald-50 text-emerald-700' },
}

export const CONTENT_FORMAT = {
  short: 'Short',
  long: 'Longo',
}

export const CONTENT_PLATFORM = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  outro: 'Outro',
}

export const TASK_STATUS_ORDER = ['todo', 'doing', 'done']
export const TASK_STATUS = {
  todo: { label: 'A fazer' },
  doing: { label: 'Fazendo' },
  done: { label: 'Feito' },
}

export const TASK_CATEGORY = {
  manual: { label: 'Manual/admin', className: 'bg-blue-50 text-blue-700', borderClassName: 'border-l-blue-400' },
  criativa: { label: 'Criativa', className: 'bg-violet-50 text-violet-700', borderClassName: 'border-l-violet-400' },
}

export const TASK_PRIORITY = {
  baixa: { label: 'Baixa', className: 'bg-slate-100 text-slate-500' },
  media: { label: 'Média', className: 'bg-amber-50 text-amber-700' },
  alta: { label: 'Alta', className: 'bg-red-50 text-red-700' },
}

export const WORK_CATEGORY = {
  aulas: { label: 'Aulas', group: 'manual' },
  administrativo: { label: 'Administrativo', group: 'manual' },
  gravacao: { label: 'Gravação', group: 'criativa' },
  edicao: { label: 'Edição', group: 'criativa' },
  roteiro: { label: 'Roteiro', group: 'criativa' },
  outro: { label: 'Outro', group: 'manual' },
}

export function formatHours(minutes) {
  const h = Math.floor((minutes || 0) / 60)
  const m = (minutes || 0) % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${m}min`
}

// Cronômetro ao vivo, com segundos (ex.: "1:04:32" ou "4:32")
export function formatStopwatch(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
