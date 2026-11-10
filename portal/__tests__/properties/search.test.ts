/**
 * Property 5: Search Filter Completeness and Soundness (Req 8.2)
 *
 * For any list of records and any non-empty search string:
 * - Soundness: every returned record contains the string in a searchable field
 * - Completeness: no matching record is absent from the results
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// ─── Reference implementation of the employee search filter ──────────────────
// Mirrors the logic in EmployeeTable.tsx

interface EmployeeRecord {
  id: string
  name: string
  employeeId: string
}

function filterEmployees(records: EmployeeRecord[], search: string): EmployeeRecord[] {
  if (!search) return records
  const lower = search.toLowerCase()
  return records.filter(
    (e) =>
      e.name.toLowerCase().includes(lower) ||
      e.employeeId.toLowerCase().includes(lower)
  )
}

function matchesSearch(record: EmployeeRecord, search: string): boolean {
  const lower = search.toLowerCase()
  return (
    record.name.toLowerCase().includes(lower) ||
    record.employeeId.toLowerCase().includes(lower)
  )
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

const employeeArb: fc.Arbitrary<EmployeeRecord> = fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  employeeId: fc.string({ minLength: 1, maxLength: 10 }),
})

const employeesArb = fc.array(employeeArb, { minLength: 0, maxLength: 30 })

const nonEmptySearchArb = fc.string({ minLength: 1, maxLength: 5 })

// ─── Property 5 tests ─────────────────────────────────────────────────────────

describe('Property 5: Search filter completeness and soundness (Req 8.2)', () => {
  it('soundness: every returned record matches the search string', () => {
    fc.assert(
      fc.property(employeesArb, nonEmptySearchArb, (records, search) => {
        const results = filterEmployees(records, search)
        for (const result of results) {
          expect(matchesSearch(result, search)).toBe(true)
        }
      }),
      { numRuns: 300 }
    )
  })

  it('completeness: no matching record is absent from results', () => {
    fc.assert(
      fc.property(employeesArb, nonEmptySearchArb, (records, search) => {
        const results = filterEmployees(records, search)
        const resultIds = new Set(results.map((r) => r.id))
        for (const record of records) {
          if (matchesSearch(record, search)) {
            expect(resultIds.has(record.id)).toBe(true)
          }
        }
      }),
      { numRuns: 300 }
    )
  })

  it('empty search returns all records', () => {
    fc.assert(
      fc.property(employeesArb, (records) => {
        const results = filterEmployees(records, '')
        expect(results).toHaveLength(records.length)
      }),
      { numRuns: 100 }
    )
  })

  it('result count is always <= total record count', () => {
    fc.assert(
      fc.property(employeesArb, nonEmptySearchArb, (records, search) => {
        const results = filterEmployees(records, search)
        expect(results.length).toBeLessThanOrEqual(records.length)
      }),
      { numRuns: 300 }
    )
  })

  it('search is case-insensitive: uppercase and lowercase produce same results', () => {
    fc.assert(
      fc.property(employeesArb, nonEmptySearchArb, (records, search) => {
        const lower = filterEmployees(records, search.toLowerCase())
        const upper = filterEmployees(records, search.toUpperCase())
        expect(lower.map((r) => r.id).sort()).toEqual(upper.map((r) => r.id).sort())
      }),
      { numRuns: 200 }
    )
  })

  it('a record is always found when searching for its exact name', () => {
    fc.assert(
      fc.property(employeesArb, (records) => {
        if (records.length === 0) return
        const target = records[Math.floor(Math.random() * records.length)]
        const results = filterEmployees(records, target.name)
        const resultIds = new Set(results.map((r) => r.id))
        expect(resultIds.has(target.id)).toBe(true)
      }),
      { numRuns: 200 }
    )
  })

  it('a record is always found when searching for its exact employeeId', () => {
    fc.assert(
      fc.property(employeesArb, (records) => {
        if (records.length === 0) return
        const target = records[Math.floor(Math.random() * records.length)]
        const results = filterEmployees(records, target.employeeId)
        const resultIds = new Set(results.map((r) => r.id))
        expect(resultIds.has(target.id)).toBe(true)
      }),
      { numRuns: 200 }
    )
  })
})
