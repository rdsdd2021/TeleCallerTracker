'use client'

import { useState, useCallback } from 'react'
import type { EmployeeReportRow } from '@/types/domain'

type SortKey = keyof Omit<EmployeeReportRow, 'callerId'>
type SortDir = 'asc' | 'desc'

interface Column {
  key: SortKey
  label: string
}

const COLUMNS: Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'totalCalls', label: 'Total Calls' },
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
  { key: 'missed', label: 'Missed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'neverAttended', label: 'Never Attended' },
  { key: 'notPickupByClient', label: 'Not Pickup by Client' },
  { key: 'connectedCalls', label: 'Connected Calls' },
  { key: 'totalDurationSec', label: 'Total Duration (sec)' },
  { key: 'avgDurationSec', label: 'Avg Duration (sec)' },
  { key: 'uniqueClients', label: 'Unique Clients' },
  { key: 'workingHoursSec', label: 'Working Hours (sec)' },
]

interface ReportTableProps {
  rows: EmployeeReportRow[]
}

export function ReportTable({ rows }: ReportTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalCalls')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        // Toggle direction: desc → asc → desc
        setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
      } else {
        setSortKey(key)
        setSortDir('desc')
      }
    },
    [sortKey]
  )

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No data for the selected period.
      </p>
    )
  }

  const sorted = [...rows].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    const aNum = aVal as number
    const bNum = bVal as number
    return sortDir === 'asc' ? aNum - bNum : bNum - aNum
  })

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {COLUMNS.map(({ key, label }) => (
              <th
                key={key}
                onClick={() => handleSort(key)}
                className="px-3 py-2 text-left font-medium text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors"
                aria-sort={
                  sortKey === key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <span className="flex items-center gap-1">
                  {label}
                  {sortKey === key && (
                    <span aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((row) => (
            <tr key={row.callerId} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2 whitespace-nowrap font-medium">{row.name}</td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row.employeeId}</td>
              <td className="px-3 py-2 text-right">{row.totalCalls}</td>
              <td className="px-3 py-2 text-right">{row.incoming}</td>
              <td className="px-3 py-2 text-right">{row.outgoing}</td>
              <td className="px-3 py-2 text-right">{row.missed}</td>
              <td className="px-3 py-2 text-right">{row.rejected}</td>
              <td className="px-3 py-2 text-right">{row.neverAttended}</td>
              <td className="px-3 py-2 text-right">{row.notPickupByClient}</td>
              <td className="px-3 py-2 text-right">{row.connectedCalls}</td>
              <td className="px-3 py-2 text-right">{row.totalDurationSec}</td>
              <td className="px-3 py-2 text-right">{row.avgDurationSec}</td>
              <td className="px-3 py-2 text-right">{row.uniqueClients}</td>
              <td className="px-3 py-2 text-right">{row.workingHoursSec}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
