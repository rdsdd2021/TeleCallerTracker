import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getPeriodRange, getPriorPeriodRange } from '@/lib/utils/periods'

// Fix "now" to a known Monday so week calculations are deterministic.
// We use a local-time anchor: 2024-06-10 14:30 local time.
// date-fns startOfDay/endOfDay operate in LOCAL time, so we anchor in local time.
const FIXED_NOW = new Date(2024, 5, 10, 14, 30, 0, 0) // June 10 2024, 14:30 local

/** Format a Date as YYYY-MM-DD in LOCAL time (not UTC) */
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('getPeriodRange', () => {
  describe('today', () => {
    it('start is the beginning of today (local midnight)', () => {
      const { start } = getPeriodRange('today')
      expect(localDateStr(start)).toBe('2024-06-10')
      expect(start.getHours()).toBe(0)
      expect(start.getMinutes()).toBe(0)
      expect(start.getSeconds()).toBe(0)
    })

    it('end is approximately now', () => {
      const { end } = getPeriodRange('today')
      expect(Math.abs(end.getTime() - FIXED_NOW.getTime())).toBeLessThan(100)
    })

    it('start is before end', () => {
      const { start, end } = getPeriodRange('today')
      expect(start.getTime()).toBeLessThan(end.getTime())
    })
  })

  describe('yesterday', () => {
    it('start is the beginning of yesterday (local)', () => {
      const { start } = getPeriodRange('yesterday')
      expect(localDateStr(start)).toBe('2024-06-09')
      expect(start.getHours()).toBe(0)
    })

    it('end is the end of yesterday (23:59:59 local)', () => {
      const { end } = getPeriodRange('yesterday')
      expect(localDateStr(end)).toBe('2024-06-09')
      expect(end.getHours()).toBe(23)
      expect(end.getMinutes()).toBe(59)
      expect(end.getSeconds()).toBe(59)
    })

    it('start is before end', () => {
      const { start, end } = getPeriodRange('yesterday')
      expect(start.getTime()).toBeLessThan(end.getTime())
    })
  })

  describe('last_week', () => {
    it('start is the Monday of last week (local)', () => {
      // FIXED_NOW is 2024-06-10 (Monday local), so last week started 2024-06-03
      const { start } = getPeriodRange('last_week')
      expect(localDateStr(start)).toBe('2024-06-03')
    })

    it('end is the Sunday of last week (local)', () => {
      const { end } = getPeriodRange('last_week')
      expect(localDateStr(end)).toBe('2024-06-09')
    })

    it('start is before end', () => {
      const { start, end } = getPeriodRange('last_week')
      expect(start.getTime()).toBeLessThan(end.getTime())
    })

    it('spans exactly 7 days', () => {
      const { start, end } = getPeriodRange('last_week')
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      expect(diffDays).toBeCloseTo(7, 0)
    })
  })
})

describe('getPriorPeriodRange', () => {
  it('prior of today is yesterday (local)', () => {
    const prior = getPriorPeriodRange('today')
    expect(localDateStr(prior.start)).toBe('2024-06-09')
    expect(localDateStr(prior.end)).toBe('2024-06-09')
  })

  it('prior of yesterday is the day before yesterday (local)', () => {
    const prior = getPriorPeriodRange('yesterday')
    expect(localDateStr(prior.start)).toBe('2024-06-08')
    expect(localDateStr(prior.end)).toBe('2024-06-08')
  })

  it('prior of last_week is the week before last (local)', () => {
    // FIXED_NOW = 2024-06-10 (Monday local)
    // last_week = 2024-06-03 → 2024-06-09
    // prior of last_week = 2024-05-27 → 2024-06-02
    const prior = getPriorPeriodRange('last_week')
    expect(localDateStr(prior.start)).toBe('2024-05-27')
    expect(localDateStr(prior.end)).toBe('2024-06-02')
  })

  it('prior period start is always before prior period end', () => {
    for (const period of ['today', 'yesterday', 'last_week'] as const) {
      const { start, end } = getPriorPeriodRange(period)
      expect(start.getTime()).toBeLessThan(end.getTime())
    }
  })

  it('prior period does not overlap with current period', () => {
    for (const period of ['today', 'yesterday', 'last_week'] as const) {
      const current = getPeriodRange(period)
      const prior = getPriorPeriodRange(period)
      // Prior end must be before current start
      expect(prior.end.getTime()).toBeLessThan(current.start.getTime())
    }
  })
})
