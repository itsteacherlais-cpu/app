export function formatCurrency(value) {
  const n = Number(value ?? 0)
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(dateStr, opts) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', opts)
}

export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
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
