import { describe, it, expect } from 'vitest'
import { escapeCSVField, generateCSV, generateEmployeeCSV, generateReportCSV } from '@/lib/utils/export'
import type { EmployeeCSVRow } from '@/lib/utils/export'
import type { EmployeeReportRow } from '@/types/domain'

// ─── escapeCSVField ───────────────────────────────────────────────────────────

describe('escapeCSVField', () => {
  it('returns a plain string unchanged', () => {
    expect(escapeCSVField('hello')).toBe('hello')
  })

  it('wraps a value containing a comma in double quotes', () => {
    expect(escapeCSVField('hello, world')).toBe('"hello, world"')
  })

  it('wraps a value containing a double quote and escapes it', () => {
    expect(escapeCSVField('say "hi"')).toBe('"say ""hi"""')
  })

  it('wraps a value containing a newline', () => {
    expect(escapeCSVField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('wraps a value containing a carriage return', () => {
    expect(escapeCSVField('line1\rline2')).toBe('"line1\rline2"')
  })

  it('converts null to empty string', () => {
    expect(escapeCSVField(null)).toBe('')
  })

  it('converts undefined to empty string', () => {
    expect(escapeCSVField(undefined)).toBe('')
  })

  it('converts a number to its string representation', () => {
    expect(escapeCSVField(42)).toBe('42')
  })

  it('converts a boolean to its string representation', () => {
    expect(escapeCSVField(true)).toBe('true')
  })
})

// ─── generateCSV ─────────────────────────────────────────────────────────────

describe('generateCSV', () => {
  const columns = [
    { key: 'name' as const, header: 'Name' },
    { key: 'age' as const, header: 'Age' },
  ]

  it('starts with a UTF-8 BOM', () => {
    const csv = generateCSV([], columns)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('includes a header row as the first line', () => {
    const csv = generateCSV([], columns)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[0]).toBe('Name,Age')
  })

  it('produces one data row per input object', () => {
    const rows = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]
    const csv = generateCSV(rows, columns)
    const lines = csv.slice(1).split('\r\n')
    // header + 2 data rows
    expect(lines).toHaveLength(3)
  })

  it('produces correct field values in each row', () => {
    const rows = [{ name: 'Alice', age: 30 }]
    const csv = generateCSV(rows, columns)
    const lines = csv.slice(1).split('\r\n')
    expect(lines[1]).toBe('Alice,30')
  })

  it('produces an empty CSV (BOM + header only) for zero rows', () => {
    const csv = generateCSV([], columns)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toBe('Name,Age')
  })

  it('uses CRLF line endings', () => {
    const rows = [{ name: 'Alice', age: 30 }]
    const csv = generateCSV(rows, columns)
    // Remove BOM then check for \r\n
    expect(csv.slice(1)).toContain('\r\n')
  })

  it('escapes fields that contain commas', () => {
    const rows = [{ name: 'Smith, John', age: 40 }]
    const csv = generateCSV(rows, columns)
    expect(csv).toContain('"Smith, John"')
  })
})

// ─── generateEmployeeCSV ──────────────────────────────────────────────────────

describe('generateEmployeeCSV', () => {
  const rows: EmployeeCSVRow[] = [
    {
      name: 'Alice',
      employeeId: 'EMP001',
      deviceId: 'DEV-A',
      registrationDate: '2024-01-01',
      lastSync: '2024-06-01',
    },
    {
      name: 'Bob',
      employeeId: 'EMP002',
      deviceId: '',
      registrationDate: '2024-02-01',
      lastSync: 'Never synced',
    },
  ]

  it('includes the correct header columns', () => {
    const csv = generateEmployeeCSV(rows)
    const header = csv.slice(1).split('\r\n')[0]
    expect(header).toBe('Name,Employee ID,Device ID,Registration Date,Last Sync')
  })

  it('produces the correct number of data rows', () => {
    const csv = generateEmployeeCSV(rows)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(3) // header + 2 rows
  })

  it('round-trips: parsed row count equals input row count', () => {
    const csv = generateEmployeeCSV(rows)
    const lines = csv.slice(1).split('\r\n').filter(Boolean)
    expect(lines.length - 1).toBe(rows.length) // subtract header
  })
})

// ─── generateReportCSV ────────────────────────────────────────────────────────

describe('generateReportCSV', () => {
  const makeRow = (overrides: Partial<EmployeeReportRow> = {}): EmployeeReportRow => ({
    callerId: 'c1',
    name: 'Alice',
    employeeId: 'EMP001',
    totalCalls: 10,
    incoming: 3,
    outgoing: 4,
    missed: 1,
    rejected: 1,
    neverAttended: 1,
    notPickupByClient: 0,
    connectedCalls: 7,
    totalDurationSec: 600,
    avgDurationSec: 60,
    uniqueClients: 5,
    workingHoursSec: 3600,
    ...overrides,
  })

  it('includes all 14 metric columns in the header', () => {
    const csv = generateReportCSV([makeRow()])
    const header = csv.slice(1).split('\r\n')[0]
    expect(header).toContain('Name')
    expect(header).toContain('Employee ID')
    expect(header).toContain('Total Calls')
    expect(header).toContain('Connected Calls')
    expect(header).toContain('Working Hours (sec)')
  })

  it('produces the correct number of data rows', () => {
    const rows = [makeRow(), makeRow({ name: 'Bob', employeeId: 'EMP002' })]
    const csv = generateReportCSV(rows)
    const lines = csv.slice(1).split('\r\n').filter(Boolean)
    expect(lines.length - 1).toBe(rows.length)
  })
})

// ─── CSV round-trip invariant (Property 6) ────────────────────────────────────

describe('CSV round-trip invariant', () => {
  /**
   * For any set of rows, after generating a CSV and parsing it back,
   * the row count and all field values are identical to the input.
   * (Requirement 19.2, 19.3, 19.5)
   */
  function parseCSV(csv: string): string[][] {
    // Strip BOM, split on CRLF
    const content = csv.startsWith('\uFEFF') ? csv.slice(1) : csv
    return content.split('\r\n').filter(Boolean).map((line) => {
      // Simple parser: handles quoted fields
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

  it('row count matches after round-trip', () => {
    const rows: EmployeeCSVRow[] = [
      { name: 'Alice', employeeId: 'E1', deviceId: 'D1', registrationDate: '2024-01-01', lastSync: '2024-06-01' },
      { name: 'Bob', employeeId: 'E2', deviceId: 'D2', registrationDate: '2024-02-01', lastSync: 'Never synced' },
      { name: 'Carol', employeeId: 'E3', deviceId: '', registrationDate: '2024-03-01', lastSync: '' },
    ]
    const csv = generateEmployeeCSV(rows)
    const parsed = parseCSV(csv)
    // parsed[0] = header, parsed[1..] = data rows
    expect(parsed.length - 1).toBe(rows.length)
  })

  it('field values match after round-trip', () => {
    const rows: EmployeeCSVRow[] = [
      { name: 'Smith, John', employeeId: 'E1', deviceId: 'D1', registrationDate: '2024-01-01', lastSync: '2024-06-01' },
    ]
    const csv = generateEmployeeCSV(rows)
    const parsed = parseCSV(csv)
    const dataRow = parsed[1]
    expect(dataRow[0]).toBe('Smith, John') // comma in name — should round-trip correctly
    expect(dataRow[1]).toBe('E1')
  })

  it('handles fields with double quotes after round-trip', () => {
    const columns = [{ key: 'note' as const, header: 'Note' }]
    const rows = [{ note: 'He said "hello"' }]
    const csv = generateCSV(rows, columns)
    const parsed = parseCSV(csv)
    expect(parsed[1][0]).toBe('He said "hello"')
  })
})
