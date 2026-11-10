/**
 * Escapes a CSV field value per RFC 4180.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
export function escapeCSVField(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generates a CSV string from an array of objects.
 * Includes a UTF-8 BOM so Excel opens it correctly.
 */
export function generateCSV<T extends object>(
  rows: T[],
  columns: { key: keyof T; header: string }[]
): string {
  const BOM = '\uFEFF'
  const header = columns.map((c) => escapeCSVField(c.header)).join(',')
  const dataRows = rows.map((row) =>
    columns.map((c) => escapeCSVField(row[c.key])).join(',')
  )
  return BOM + [header, ...dataRows].join('\r\n')
}

// Specific CSV generators
import type { EmployeeReportRow } from '@/types/domain'

export interface EmployeeCSVRow {
  name: string
  employeeId: string
  deviceId: string
  registrationDate: string
  lastSync: string
}

export function generateEmployeeCSV(rows: EmployeeCSVRow[]): string {
  return generateCSV(rows, [
    { key: 'name', header: 'Name' },
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'deviceId', header: 'Device ID' },
    { key: 'registrationDate', header: 'Registration Date' },
    { key: 'lastSync', header: 'Last Sync' },
  ])
}

export function generateReportCSV(rows: EmployeeReportRow[]): string {
  return generateCSV(rows, [
    { key: 'name', header: 'Name' },
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'totalCalls', header: 'Total Calls' },
    { key: 'incoming', header: 'Incoming' },
    { key: 'outgoing', header: 'Outgoing' },
    { key: 'missed', header: 'Missed' },
    { key: 'rejected', header: 'Rejected' },
    { key: 'neverAttended', header: 'Never Attended' },
    { key: 'notPickupByClient', header: 'Not Pickup by Client' },
    { key: 'connectedCalls', header: 'Connected Calls' },
    { key: 'totalDurationSec', header: 'Total Duration (sec)' },
    { key: 'avgDurationSec', header: 'Avg Duration (sec)' },
    { key: 'uniqueClients', header: 'Unique Clients' },
    { key: 'workingHoursSec', header: 'Working Hours (sec)' },
  ])
}

