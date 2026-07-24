import { addMonths, differenceInCalendarDays, format } from 'date-fns'

export function computeEndDate(startDate, durationMonths) {
  const d = addMonths(new Date(`${startDate}T00:00:00`), Number(durationMonths))
  return format(d, 'yyyy-MM-dd')
}

export function getContractStatus(endDate) {
  const daysLeft = differenceInCalendarDays(new Date(endDate), new Date())
  if (daysLeft < 0) return { key: 'expired', label: 'Vencido', className: 'bg-red-50 text-red-700' }
  if (daysLeft <= 30) return { key: 'expiring', label: `Vence em ${daysLeft}d`, className: 'bg-amber-50 text-amber-700' }
  return { key: 'active', label: 'Ativo', className: 'bg-emerald-50 text-emerald-700' }
}

export const DURATION_PRESETS = [3, 6, 12, 24]
