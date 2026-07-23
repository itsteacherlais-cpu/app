import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths } from 'date-fns'

export function getPeriodRange(type, referenceDate = new Date()) {
  if (type === 'week') {
    return {
      start: startOfWeek(referenceDate, { weekStartsOn: 1 }),
      end: endOfWeek(referenceDate, { weekStartsOn: 1 }),
    }
  }
  return {
    start: startOfMonth(referenceDate),
    end: endOfMonth(referenceDate),
  }
}

export function addPeriod(type, date, n = 1) {
  return type === 'week' ? addWeeks(date, n) : addMonths(date, n)
}
