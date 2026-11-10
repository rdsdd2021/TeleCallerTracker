import {
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
} from 'date-fns'
import type { Period } from '@/types/domain'

export function getPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: now }
    case 'yesterday':
      return {
        start: startOfDay(subDays(now, 1)),
        end: endOfDay(subDays(now, 1)),
      }
    case 'last_week': {
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      return { start: lastWeekStart, end: lastWeekEnd }
    }
  }
}

export function getPriorPeriodRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  switch (period) {
    case 'today':
      return getPeriodRange('yesterday')
    case 'yesterday':
      return {
        start: startOfDay(subDays(now, 2)),
        end: endOfDay(subDays(now, 2)),
      }
    case 'last_week': {
      // Prior week = 2 weeks ago
      const twoWeeksAgo = subWeeks(now, 2)
      return {
        start: startOfWeek(twoWeeksAgo, { weekStartsOn: 1 }),
        end: endOfWeek(twoWeeksAgo, { weekStartsOn: 1 }),
      }
    }
  }
}
