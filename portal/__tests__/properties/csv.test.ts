/**
 * Property 6: CSV Export Round-Trip Invariant (Req 19.2, 19.3, 19.5)
 *
 * For any set of rows, after generating a CSV and parsing it back,
 * the row count and all field values are identical to the input.
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { generateCSV, escapeCSVField } from '@/lib/utils/export'

// ─── CSV parser (mirrors what Excel / a standard parser would do) ─────────────

function parseCSV(csv: string): string[][] {
  const content = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
  const lines = content.split('\r\n').filter(Boolean)
  return lines.map((line) => {
    const fields: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current)
    return fields
  })
}

// ─── Arbitraries ──────────────────────────────────────────────────────────────

// Printable ASCII strings that may contain CSV-special characters
const csvSafeStringArb = fc.string({ minLength: 0, maxLength: 100 })

const rowArb = fc.record({
  name: csvSafeStringArb,
  value: fc.oneof(
    fc.integer({ min: 0, max: 9999 }).map(String),
    csvSafeStringArb
  ),
})

const rowsArb = fc.array(rowArb, { minLength: 0, maxLength: 30 })

const columns = [
  { key: 'name' as const, header: 'Name' },
  { key: 'value' as const, header: 'Value' },
]

// ─── Property 6 tests ─────────────────────────────────────────────────────────

describe('Property 6: CSV round-trip invariant (Req 19.2, 19.3, 19.5)', () => {
  it('row count after round-trip equals input row count', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const csv = generateCSV(rows, columns)
        const parsed = parseCSV(csv)
        // parsed[0] = header, parsed[1..] = data rows
        expect(parsed.length - 1).toBe(rows.length)
      }),
      { numRuns: 200 }
    )
  })

  it('all field values are identical after round-trip', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const csv = generateCSV(rows, columns)
        const parsed = parseCSV(csv)
        for (let i = 0; i < rows.length; i++) {
          const dataRow = parsed[i + 1] // skip header
          expect(dataRow[0]).toBe(rows[i].name)
          expect(dataRow[1]).toBe(rows[i].value)
        }
      }),
      { numRuns: 200 }
    )
  })

  it('header row is always present and correct', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const csv = generateCSV(rows, columns)
        const parsed = parseCSV(csv)
        expect(parsed[0]).toEqual(['Name', 'Value'])
      }),
      { numRuns: 100 }
    )
  })

  it('CSV always starts with UTF-8 BOM', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const csv = generateCSV(rows, columns)
        expect(csv.charCodeAt(0)).toBe(0xfeff)
      }),
      { numRuns: 100 }
    )
  })

  it('fields containing commas round-trip correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.stringMatching(/[a-z,]+/).filter((s) => s.includes(',')),
            value: fc.constant('42'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (rows) => {
          const csv = generateCSV(rows, columns)
          const parsed = parseCSV(csv)
          for (let i = 0; i < rows.length; i++) {
            expect(parsed[i + 1][0]).toBe(rows[i].name)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('fields containing double quotes round-trip correctly', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.stringMatching(/[a-z"]+/).filter((s) => s.includes('"')),
            value: fc.constant('test'),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (rows) => {
          const csv = generateCSV(rows, columns)
          const parsed = parseCSV(csv)
          for (let i = 0; i < rows.length; i++) {
            expect(parsed[i + 1][0]).toBe(rows[i].name)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── escapeCSVField property tests ───────────────────────────────────────────

describe('escapeCSVField properties', () => {
  it('output never contains unescaped commas outside quotes', () => {
    fc.assert(
      fc.property(csvSafeStringArb, (value) => {
        const escaped = escapeCSVField(value)
        if (escaped.startsWith('"')) {
          // Quoted field — commas inside are fine
          expect(escaped.endsWith('"')).toBe(true)
        } else {
          // Unquoted field — must not contain commas
          expect(escaped).not.toContain(',')
        }
      }),
      { numRuns: 300 }
    )
  })

  it('output is idempotent when parsed back', () => {
    fc.assert(
      fc.property(csvSafeStringArb, (value) => {
        const escaped = escapeCSVField(value)
        // Parse the escaped field back
        let parsed = escaped
        if (parsed.startsWith('"') && parsed.endsWith('"')) {
          parsed = parsed.slice(1, -1).replace(/""/g, '"')
        }
        expect(parsed).toBe(value === null || value === undefined ? '' : String(value))
      }),
      { numRuns: 300 }
    )
  })
})
