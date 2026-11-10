import { describe, it, expect } from 'vitest'
import { computeEmployeeMetrics, computeWorkingHours, computeMetricsWithDelta } from '@/lib/utils/metrics'
import type { CallLog } from '@/types/domain'

// ─── Helpers ──────────────────────────────────────────────────────────────────

let idCounter = 0
function makeLog(overrides: Partial<CallLog> = {}): CallLog {
  return {
    id: `log-${++idCounter}`,
    callerId: 'caller-1',
    orgId: 'org-1',
    contactNumber: '+10000000001',
    callType: 'outgoing',
    durationSec: 60,
    calledAt: '2024-06-01T09:00:00.000Z',
    ...overrides,
  }
}

// ─── computeWorkingHours ──────────────────────────────────────────────────────

describe('computeWorkingHours', () => {
  it('returns 0 for an empty log array', () => {
    expect(computeWorkingHours([])).toBe(0)
  })

  it('returns 0 for a single call (first === last)', () => {
    const logs = [makeLog({ calledAt: '2024-06-01T09:00:00.000Z' })]
    expect(computeWorkingHours(logs)).toBe(0)
  })

  it('computes the span between first and last call on a single day', () => {
    const logs = [
      makeLog({ calledAt: '2024-06-01T09:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-01T10:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-01T11:30:00.000Z' }),
    ]
    // span = 11:30 - 09:00 = 2.5 hours = 9000 seconds
    expect(computeWorkingHours(logs)).toBe(9000)
  })

  it('sums spans across multiple days', () => {
    const logs = [
      // Day 1: 1 hour span
      makeLog({ calledAt: '2024-06-01T09:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-01T10:00:00.000Z' }),
      // Day 2: 2 hour span
      makeLog({ calledAt: '2024-06-02T08:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-02T10:00:00.000Z' }),
    ]
    // 3600 + 7200 = 10800
    expect(computeWorkingHours(logs)).toBe(10800)
  })

  it('handles calls in non-chronological order', () => {
    const logs = [
      makeLog({ calledAt: '2024-06-01T11:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-01T09:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-01T10:00:00.000Z' }),
    ]
    // span = 11:00 - 09:00 = 7200 seconds
    expect(computeWorkingHours(logs)).toBe(7200)
  })

  it('treats calls on different UTC days as separate days', () => {
    const logs = [
      makeLog({ calledAt: '2024-06-01T23:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-02T01:00:00.000Z' }),
    ]
    // Each day has only one call → span = 0 for each day
    expect(computeWorkingHours(logs)).toBe(0)
  })
})

// ─── computeEmployeeMetrics ───────────────────────────────────────────────────

describe('computeEmployeeMetrics', () => {
  it('returns all zeros for an empty log array', () => {
    const result = computeEmployeeMetrics([])
    expect(result.totalCalls).toBe(0)
    expect(result.connectedCalls).toBe(0)
    expect(result.totalDurationSec).toBe(0)
    expect(result.uniqueClients).toBe(0)
    expect(result.avgDurationSec).toBe(0)
  })

  it('counts total calls correctly', () => {
    const logs = [makeLog(), makeLog(), makeLog()]
    expect(computeEmployeeMetrics(logs).totalCalls).toBe(3)
  })

  it('counts each call type correctly', () => {
    const logs = [
      makeLog({ callType: 'incoming' }),
      makeLog({ callType: 'incoming' }),
      makeLog({ callType: 'outgoing' }),
      makeLog({ callType: 'missed' }),
      makeLog({ callType: 'rejected' }),
      makeLog({ callType: 'never_attended' }),
      makeLog({ callType: 'not_pickup_by_client' }),
    ]
    const result = computeEmployeeMetrics(logs)
    expect(result.incoming).toBe(2)
    expect(result.outgoing).toBe(1)
    expect(result.missed).toBe(1)
    expect(result.rejected).toBe(1)
    expect(result.neverAttended).toBe(1)
    expect(result.notPickupByClient).toBe(1)
  })

  it('counts connected calls as those with durationSec > 0', () => {
    const logs = [
      makeLog({ durationSec: 0 }),
      makeLog({ durationSec: 30 }),
      makeLog({ durationSec: 120 }),
    ]
    expect(computeEmployeeMetrics(logs).connectedCalls).toBe(2)
  })

  it('sums total duration correctly', () => {
    const logs = [
      makeLog({ durationSec: 100 }),
      makeLog({ durationSec: 200 }),
      makeLog({ durationSec: 300 }),
    ]
    expect(computeEmployeeMetrics(logs).totalDurationSec).toBe(600)
  })

  it('computes average duration correctly', () => {
    const logs = [
      makeLog({ durationSec: 100 }),
      makeLog({ durationSec: 200 }),
    ]
    expect(computeEmployeeMetrics(logs).avgDurationSec).toBe(150)
  })

  it('counts unique clients by contactNumber', () => {
    const logs = [
      makeLog({ contactNumber: '+10000000001' }),
      makeLog({ contactNumber: '+10000000001' }), // duplicate
      makeLog({ contactNumber: '+10000000002' }),
    ]
    expect(computeEmployeeMetrics(logs).uniqueClients).toBe(2)
  })

  // ── Property: call type partition invariant (Requirement 20.7) ──────────────
  it('incoming + outgoing + missed + rejected + neverAttended + notPickupByClient === totalCalls', () => {
    const logs = [
      makeLog({ callType: 'incoming' }),
      makeLog({ callType: 'outgoing' }),
      makeLog({ callType: 'missed' }),
      makeLog({ callType: 'rejected' }),
      makeLog({ callType: 'never_attended' }),
      makeLog({ callType: 'not_pickup_by_client' }),
      makeLog({ callType: 'incoming' }),
    ]
    const r = computeEmployeeMetrics(logs)
    const sum = r.incoming + r.outgoing + r.missed + r.rejected + r.neverAttended + r.notPickupByClient
    expect(sum).toBe(r.totalCalls)
  })

  // ── Property: connected calls monotonicity (Requirement 20.6) ───────────────
  it('connectedCalls <= totalCalls for any input', () => {
    const logs = [
      makeLog({ durationSec: 0 }),
      makeLog({ durationSec: 60 }),
      makeLog({ durationSec: 0 }),
    ]
    const r = computeEmployeeMetrics(logs)
    expect(r.connectedCalls).toBeLessThanOrEqual(r.totalCalls)
  })

  it('connectedCalls <= totalCalls when all calls are connected', () => {
    const logs = [makeLog({ durationSec: 10 }), makeLog({ durationSec: 20 })]
    const r = computeEmployeeMetrics(logs)
    expect(r.connectedCalls).toBeLessThanOrEqual(r.totalCalls)
    expect(r.connectedCalls).toBe(r.totalCalls)
  })

  it('connectedCalls <= totalCalls when no calls are connected', () => {
    const logs = [makeLog({ durationSec: 0 }), makeLog({ durationSec: 0 })]
    const r = computeEmployeeMetrics(logs)
    expect(r.connectedCalls).toBe(0)
    expect(r.connectedCalls).toBeLessThanOrEqual(r.totalCalls)
  })
})

// ─── Total calls additivity (Requirement 20.5) ───────────────────────────────

describe('total calls additivity', () => {
  /**
   * For any non-overlapping split of logs into two subsets,
   * totalCalls(all) === totalCalls(subset1) + totalCalls(subset2).
   */
  it('totalCalls is additive across a date split', () => {
    const before = [
      makeLog({ calledAt: '2024-06-01T10:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-01T11:00:00.000Z' }),
    ]
    const after = [
      makeLog({ calledAt: '2024-06-02T10:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-03T10:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-04T10:00:00.000Z' }),
    ]
    const all = [...before, ...after]

    const totalAll = computeEmployeeMetrics(all).totalCalls
    const totalBefore = computeEmployeeMetrics(before).totalCalls
    const totalAfter = computeEmployeeMetrics(after).totalCalls

    expect(totalAll).toBe(totalBefore + totalAfter)
  })

  it('totalCalls is additive for an arbitrary even split', () => {
    const logs = Array.from({ length: 10 }, (_, i) =>
      makeLog({ calledAt: `2024-06-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` })
    )
    const half = Math.floor(logs.length / 2)
    const part1 = logs.slice(0, half)
    const part2 = logs.slice(half)

    expect(computeEmployeeMetrics(logs).totalCalls).toBe(
      computeEmployeeMetrics(part1).totalCalls + computeEmployeeMetrics(part2).totalCalls
    )
  })
})

// ─── computeMetricsWithDelta ──────────────────────────────────────────────────

describe('computeMetricsWithDelta', () => {
  const makeRaw = (overrides: Record<string, number> = {}) => ({
    total_calls: 100,
    total_duration_sec: 6000,
    incoming_calls: 40,
    outgoing_calls: 30,
    missed_calls: 15,
    rejected_calls: 5,
    never_attended_calls: 5,
    not_pickup_by_client: 5,
    unique_clients: 50,
    working_hours_sec: 28800,
    connected_calls: 70,
    ...overrides,
  })

  it('maps snake_case RPC keys to camelCase domain keys', () => {
    const result = computeMetricsWithDelta(makeRaw(), makeRaw())
    expect(result).toHaveProperty('totalCalls')
    expect(result).toHaveProperty('incomingCalls')
    expect(result).toHaveProperty('connectedCalls')
  })

  it('computes a positive delta when current > prior', () => {
    const current = makeRaw({ total_calls: 110 })
    const prior = makeRaw({ total_calls: 100 })
    const result = computeMetricsWithDelta(current, prior)
    expect(result.delta?.totalCalls).toBe(10) // (110-100)/100 * 100 = 10%
  })

  it('computes a negative delta when current < prior', () => {
    const current = makeRaw({ total_calls: 80 })
    const prior = makeRaw({ total_calls: 100 })
    const result = computeMetricsWithDelta(current, prior)
    expect(result.delta?.totalCalls).toBe(-20) // (80-100)/100 * 100 = -20%
  })

  it('returns undefined delta when prior is 0', () => {
    const current = makeRaw({ total_calls: 50 })
    const prior = makeRaw({ total_calls: 0 })
    const result = computeMetricsWithDelta(current, prior)
    expect(result.delta?.totalCalls).toBeUndefined()
  })

  it('returns 0 delta when current equals prior', () => {
    const raw = makeRaw()
    const result = computeMetricsWithDelta(raw, raw)
    expect(result.delta?.totalCalls).toBe(0)
  })

  it('rounds delta to one decimal place', () => {
    const current = makeRaw({ total_calls: 103 })
    const prior = makeRaw({ total_calls: 100 })
    const result = computeMetricsWithDelta(current, prior)
    expect(result.delta?.totalCalls).toBe(3) // 3.0%
  })

  it('handles fractional deltas correctly', () => {
    const current = makeRaw({ total_calls: 101 })
    const prior = makeRaw({ total_calls: 300 })
    const result = computeMetricsWithDelta(current, prior)
    // (101-300)/300 * 100 = -66.333... → -66.3
    expect(result.delta?.totalCalls).toBe(-66.3)
  })
})

// ─── Working hours calculation correctness (Property 11) ─────────────────────

describe('working hours calculation correctness (Property 11)', () => {
  /**
   * For any array of call logs, computeWorkingHours equals the sum of
   * (max(called_at) - min(called_at)) per calendar day.
   */
  it('matches manual per-day calculation for a multi-day dataset', () => {
    const logs = [
      // Day 1: 09:00 → 17:00 = 8 hours = 28800s
      makeLog({ calledAt: '2024-06-01T09:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-01T12:00:00.000Z' }),
      makeLog({ calledAt: '2024-06-01T17:00:00.000Z' }),
      // Day 2: 08:30 → 16:30 = 8 hours = 28800s
      makeLog({ calledAt: '2024-06-02T08:30:00.000Z' }),
      makeLog({ calledAt: '2024-06-02T16:30:00.000Z' }),
    ]

    // Manual calculation
    const day1Span = (new Date('2024-06-01T17:00:00.000Z').getTime() - new Date('2024-06-01T09:00:00.000Z').getTime()) / 1000
    const day2Span = (new Date('2024-06-02T16:30:00.000Z').getTime() - new Date('2024-06-02T08:30:00.000Z').getTime()) / 1000
    const expected = day1Span + day2Span

    expect(computeWorkingHours(logs)).toBe(expected)
  })
})
