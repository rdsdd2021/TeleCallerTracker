'use client'

import { useState, useMemo, useCallback } from 'react'
import { ExportButton } from '@/components/ExportButton'
import type { EmployeeRow } from '@/lib/queries/employees'

interface EmployeeTableProps {
  employees: EmployeeRow[]
  orgId: string
}

const PAGE_SIZE = 20

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never synced'
  return new Date(dateStr).toLocaleDateString()
}

export function EmployeeTable({ employees, orgId }: EmployeeTableProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [displaySearch, setDisplaySearch] = useState('')

  const handleSearchChange = useCallback((value: string) => {
    setDisplaySearch(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    const timeout = setTimeout(() => {
      setSearch(value)
      setPage(0)
    }, 300)
    setSearchTimeout(timeout)
  }, [searchTimeout])

  const filtered = useMemo(() => {
    if (!search) return employees
    const lower = search.toLowerCase()
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(lower) ||
        e.employeeId.toLowerCase().includes(lower)
    )
  }, [employees, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <input
          type="search"
          placeholder="Search by name or employee ID..."
          value={displaySearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full max-w-sm px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search employees"
        />
        <div className="flex gap-2">
          <ExportButton type="employees" orgId={orgId} />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Employee ID</th>
              <th className="px-4 py-3 text-left font-medium">Device ID</th>
              <th className="px-4 py-3 text-left font-medium">Registration Date</th>
              <th className="px-4 py-3 text-left font-medium">Last Sync</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  {search ? 'No employees match your search.' : 'No employees registered yet.'}
                </td>
              </tr>
            ) : (
              paginated.map((emp) => (
                <tr key={emp.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{emp.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{emp.employeeId}</td>
                  <td className="px-4 py-3 font-mono text-xs">{emp.deviceId ?? '—'}</td>
                  <td className="px-4 py-3">{formatDate(emp.registrationDate)}</td>
                  <td className="px-4 py-3">
                    {emp.lastSync ? (
                      formatDate(emp.lastSync)
                    ) : (
                      <span className="text-muted-foreground italic">Never synced</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-accent transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 border rounded-md disabled:opacity-50 hover:bg-accent transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
