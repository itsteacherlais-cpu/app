import { startOfYear, endOfYear, startOfMonth, endOfMonth, subMonths, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function getYearRange(date = new Date()) {
  return { start: startOfYear(date), end: endOfYear(date) }
}

export function monthKey(date) {
  return format(date, 'yyyy-MM')
}

export function monthLabel(date) {
  return format(date, 'MMM/yy', { locale: ptBR })
}

export function getLastMonths(n, date = new Date()) {
  const months = []
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(date, i)
    months.push({ key: monthKey(d), label: monthLabel(d), start: startOfMonth(d), end: endOfMonth(d) })
  }
  return months
}
