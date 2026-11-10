/**
 * Property-based tests for call metric calculation correctness.
 * Uses fast-check to generate arbitrary inputs and verify invariants.
 *
 * Properties covered:
 *   Property 7:  Exclusion list filter invariant (Req 9.5)
 *   Property 8:  Call type partition invariant (Req 20.7)
 *   Property 9:  Connected calls monotonicity (Req 20.6)
 *   Property 10: Total calls additivity (Req 20.5)
 *   Property 11: Working hours calculation correctness (Req 15.8)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { computeEmployeeMetrics, computeWorkingHours } from '@/lib/utils/metrics'
import type { CallLog } from '@/types/domain'

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const callTypeArb = fc.constantFrom(
  'incoming',
  'outgoing',
  'missed',
  'rejected',
  'never_attended',
  'not_pickup_by_client'
) as fc.Arbitrary<CallLog['callType']>

const phoneArb = fc.stringMatching(/^\+[1-9]\d{6,9}$/)

const isoDateArb = fc
  .date({ min: new Date('2024-01-01'), max: new Date('2024-12-31') })
  .map((d) => d.toISOString())

const callLogArb: fc.Arbitrary<CallLog> = fc.record({
  id: fc.uuid(),
  callerId: fc.uuid(),
  orgId: fc.uuid(),
  contactNumber: phoneArb,
  callType: callTypeArb,
  durationSec: fc.nat(3600),
  calledAt: isoDateArb,
})

const callLogsArb = fc.array(callLogArb, { minLength: 0, maxLength: 50 })

// ─── Property 8: Call type partition invariant ────────────────────────────────

describe('Property 8: Call type partition invariant (Req 20.7)', () => {
  it('incoming + outgoing + missed + rejected + neverAttended + notPickupByClient === totalCalls for any input', () => {
    fc.assert(
      fc.property(callLogsArb, (logs) => {
        const r = computeEmployeeMetrics(logs)
        const sum =
          r.incoming +
          r.outgoing +
          r.missed +
          r.rejected +
          r.neverAttended +
          r.notPickupByClient
        expect(sum).toBe(r.totalCalls)
      }),
      { numRuns: 200 }
    )
  })
})

// ─── Property 9: Connected calls monotonicity ─────────────────────────────────

describe('Property 9: Connected calls monotonicity (Req 20.6)', () => {
  it('connectedCalls <= totalCalls for any input', () => {
    fc.assert(
      fc.property(callLogsArb, (logs) => {
        const r = computeEmployeeMetrics(logs)
        expect(r.connectedCalls).toBeLessThanOrEqual(r.totalCalls)
      }),
      { numRuns: 200 }
    )
  })

  it('connectedCalls >= 0 for any input', () => {
    fc.assert(
      fc.property(callLogsArb, (logs) => {
        const r = computeEmployeeMetrics(logs)
        expect(r.connectedCalls).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 200 }
    )
  })
})

// ─── Property 10: Total calls additivity ─────────────────────────────────────

describe('Property 10: Total calls additivity (Req 20.5)', () => {
  it('totalCalls(all) === totalCalls(part1) + totalCalls(part2) for any split', () => {
    fc.assert(
      fc.property(
        callLogsArb,
        fc.nat().map((n) => n), // split index
        (logs, splitSeed) => {
          if (logs.length === 0) return // trivially true
          const splitAt = splitSeed % (logs.length + 1)
          const part1 = logs.slice(0, splitAt)
          const part2 = logs.slice(splitAt)

          const totalAll = computeEmployeeMetrics(logs).totalCalls
          const totalPart1 = computeEmployeeMetrics(part1).totalCalls
          const totalPart2 = computeEmployeeMetrics(part2).totalCalls

          expect(totalAll).toBe(totalPart1 + totalPart2)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('totalDurationSec is also additive across any split', () => {
    fc.assert(
      fc.property(callLogsArb, fc.nat(), (logs, splitSeed) => {
        if (logs.length === 0) return
        const splitAt = splitSeed % (logs.length + 1)
        const part1 = logs.slice(0, splitAt)
        const part2 = logs.slice(splitAt)

        const durationAll = computeEmployeeMetrics(logs).totalDurationSec
        const durationPart1 = computeEmployeeMetrics(part1).totalDurationSec
        const durationPart2 = computeEmployeeMetrics(part2).totalDurationSec

        expect(durationAll).toBe(durationPart1 + durationPart2)
      }),
      { numRuns: 200 }
    )
  })
})

// ─── Property 11: Working hours calculation correctness ──────────────────────

describe('Property 11: Working hours calculation correctness (Req 15.8)', () => {
  it('computeWorkingHours equals sum of (max - min) per calendar day', () => {
    fc.assert(
      fc.property(callLogsArb, (logs) => {
        // Manual reference implementation
        const byDay = new Map<string, number[]>()
        for (const log of logs) {
          const d = new Date(log.calledAt)
          const key = d.toISOString().slice(0, 10)
          if (!byDay.has(key)) byDay.set(key, [])
          byDay.get(key)!.push(d.getTime())
        }
        let expected = 0
        for (const times of Array.from(byDay.values())) {
          expected += (Math.max(...times) - Math.min(...times)) / 1000
        }

        expect(computeWorkingHours(logs)).toBe(expected)
      }),
      { numRuns: 200 }
    )
  })

  it('working hours is always >= 0', () => {
    fc.assert(
      fc.property(callLogsArb, (logs) => {
        expect(computeWorkingHours(logs)).toBeGreaterThanOrEqual(0)
      }),
      { numRuns: 200 }
    )
  })
})

// ─── Property 7: Exclusion list filter invariant ─────────────────────────────

describe('Property 7: Exclusion list filter invariant (Req 9.5)', () => {
  /**
   * For any set of call_logs and any exclusion list,
   * every metric equals the metric computed on the subset where
   * contactNumber NOT IN exclusion_list.
   */
  function applyExclusion(logs: CallLog[], exclusionList: string[]): CallLog[] {
    const excluded = new Set(exclusionList)
    return logs.filter((l) => !excluded.has(l.contactNumber))
  }

  it('totalCalls after exclusion equals totalCalls of filtered subset', () => {
    fc.assert(
      fc.property(
        callLogsArb,
        fc.array(phoneArb, { minLength: 0, maxLength: 5 }),
        (logs, exclusionList) => {
          const filtered = applyExclusion(logs, exclusionList)
          const metricsAll = computeEmployeeMetrics(logs)
          const metricsFiltered = computeEmployeeMetrics(filtered)

          // The filtered metrics should match computing on the filtered subset directly
          expect(metricsFiltered.totalCalls).toBe(filtered.length)
          expect(metricsFiltered.totalCalls).toBeLessThanOrEqual(metricsAll.totalCalls)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('connectedCalls after exclusion <= connectedCalls before exclusion', () => {
    fc.assert(
      fc.property(
        callLogsArb,
        fc.array(phoneArb, { minLength: 0, maxLength: 5 }),
        (logs, exclusionList) => {
          const filtered = applyExclusion(logs, exclusionList)
          const before = computeEmployeeMetrics(logs).connectedCalls
          const after = computeEmployeeMetrics(filtered).connectedCalls
          expect(after).toBeLessThanOrEqual(before)
        }
      ),
      { numRuns: 200 }
    )
  })

  it('partition invariant holds after exclusion', () => {
    fc.assert(
      fc.property(
        callLogsArb,
        fc.array(phoneArb, { minLength: 0, maxLength: 5 }),
        (logs, exclusionList) => {
          const filtered = applyExclusion(logs, exclusionList)
          const r = computeEmployeeMetrics(filtered)
          const sum =
            r.incoming + r.outgoing + r.missed + r.rejected + r.neverAttended + r.notPickupByClient
          expect(sum).toBe(r.totalCalls)
        }
      ),
      { numRuns: 200 }
    )
  })
})
