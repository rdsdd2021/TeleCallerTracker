'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { RefreshCw } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawRow {
  caller_id:         string
  name:              string
  employee_id:       string
  hour:              number   // 0–23
  total_calls:       number
  connected_calls:   number
  total_duration_sec: number
}

interface SlotStats {
  totalCalls:       number
  connectedCalls:   number
  totalDurationSec: number
}

interface EmployeeHourly {
  callerId:   string
  name:       string
  employeeId: string
  bySlot:     Record<string, SlotStats>   // key = slot label e.g. "09:00 AM"
  totals:     SlotStats
}

interface HourlyAnalysisTabProps {
  orgId:     string
  startDate: string
  endDate:   string
}

// ─── Constants ────────────────────────────────────────────────────────────────

// 2-hour time slots matching the reference image
const SLOTS: { label: string; hours: number[] }[] = [
  { label: 'Before 10:00 AM', hours: [0,1,2,3,4,5,6,7,8,9] },
  { label: '10:00 AM – 12:00 PM', hours: [10,11] },
  { label: '12:00 PM – 02:00 PM', hours: [12,13] },
  { label: '02:00 PM – 04:00 PM', hours: [14,15] },
  { label: '04:00 PM – 06:00 PM', hours: [16,17] },
  { label: '06:00 PM – 08:00 PM', hours: [18,19] },
  { label: '08:00 PM – 10:00 PM', hours: [20,21] },
  { label: 'After 10:00 PM',      hours: [22,23] },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDur(sec: number): string {
  if (!sec) return '00:00:00'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':')
}

function pct(num: number, den: number): string {
  if (!den) return '0.0%'
  return ((num / den) * 100).toFixed(1) + '%'
}

function emptySlot(): SlotStats {
  return { totalCalls: 0, connectedCalls: 0, totalDurationSec: 0 }
}

function addSlot(a: SlotStats, b: SlotStats): SlotStats {
  return {
    totalCalls:       a.totalCalls       + b.totalCalls,
    connectedCalls:   a.connectedCalls   + b.connectedCalls,
    totalDurationSec: a.totalDurationSec + b.totalDurationSec,
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HourlyAnalysisTab({ orgId: _orgId, startDate, endDate }: HourlyAnalysisTabProps) {
  const [rows, setRows]       = useState<RawRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/reports/hourly-breakdown?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`
      )
      if (!res.ok) throw new Error('Failed to fetch hourly data')
      const data: RawRow[] = await res.json()
      setRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Aggregate raw rows into per-employee per-slot stats ──────────────────
  const { employees, orgSlots, orgTotals } = useMemo(() => {
    const empMap = new Map<string, EmployeeHourly>()

    for (const row of rows) {
      if (!empMap.has(row.caller_id)) {
        empMap.set(row.caller_id, {
          callerId:   row.caller_id,
          name:       row.name,
          employeeId: row.employee_id,
          bySlot:     {},
          totals:     emptySlot(),
        })
      }
      const emp = empMap.get(row.caller_id)!

      // Find which slot this hour belongs to
      const slot = SLOTS.find(s => s.hours.includes(row.hour))
      if (!slot) continue

      const existing = emp.bySlot[slot.label] ?? emptySlot()
      emp.bySlot[slot.label] = addSlot(existing, {
        totalCalls:       row.total_calls,
        connectedCalls:   row.connected_calls,
        totalDurationSec: row.total_duration_sec,
      })
      emp.totals = addSlot(emp.totals, {
        totalCalls:       row.total_calls,
        connectedCalls:   row.connected_calls,
        totalDurationSec: row.total_duration_sec,
      })
    }

    // Org-level per-slot totals
    const orgSlots: Record<string, SlotStats> = {}
    let orgTotals = emptySlot()
    for (const emp of Array.from(empMap.values())) {
      for (const [label, stats] of Object.entries(emp.bySlot)) {
        orgSlots[label] = addSlot(orgSlots[label] ?? emptySlot(), stats)
      }
      orgTotals = addSlot(orgTotals, emp.totals)
    }

    return {
      employees: Array.from(empMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
      orgSlots,
      orgTotals,
    }
  }, [rows])

  // ── Chart data — grouped bar per slot ────────────────────────────────────
  const chartData = useMemo(() =>
    SLOTS.map(slot => ({
      slot: slot.label.replace(' AM', 'am').replace(' PM', 'pm').replace('Before ', '<').replace('After ', '>'),
      'Total Calls':     orgSlots[slot.label]?.totalCalls     ?? 0,
      'Connected Calls': orgSlots[slot.label]?.connectedCalls ?? 0,
    })),
  [orgSlots])

  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
        <RefreshCw className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading hourly data…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-sm text-red-600 bg-red-50 rounded-lg m-4">
        {error}
        <button onClick={fetchData} className="ml-3 underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-5">

      {/* ── 1. Hourly summary table ─────────────────────────────────────── */}
      <div>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-700">
                <th className="px-3 py-2 text-left font-semibold border border-gray-200 min-w-[160px]">
                  Hourly Time Slot
                </th>
                <th className="px-3 py-2 text-center font-semibold border border-gray-200 min-w-[80px]">
                  Total Calls
                </th>
                <th className="px-3 py-2 text-center font-semibold border border-gray-200 min-w-[110px]">
                  Total Connected Calls
                </th>
                <th className="px-3 py-2 text-center font-semibold border border-gray-200 min-w-[100px]">
                  Total Duration
                </th>
                <th className="px-3 py-2 text-center font-semibold border border-gray-200 min-w-[120px]">
                  Total Calls (%)
                </th>
                <th className="px-3 py-2 text-center font-semibold border border-gray-200 min-w-[140px]">
                  Total Connected Calls (%)
                </th>
                <th className="px-3 py-2 text-center font-semibold border border-gray-200 min-w-[130px]">
                  Total Duration (%)
                </th>
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot, i) => {
                const s = orgSlots[slot.label] ?? emptySlot()
                return (
                  <tr key={slot.label}
                    className={i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-gray-50 hover:bg-yellow-50'}>
                    <td className="px-3 py-2 font-medium border border-gray-200">{slot.label}</td>
                    <td className="px-3 py-2 text-center border border-gray-200">{s.totalCalls}</td>
                    <td className="px-3 py-2 text-center border border-gray-200 text-green-700 font-medium">
                      {s.connectedCalls}
                    </td>
                    <td className="px-3 py-2 text-center border border-gray-200">{fmtDur(s.totalDurationSec)}</td>
                    <td className="px-3 py-2 text-center border border-gray-200">
                      {pct(s.totalCalls, orgTotals.totalCalls)}
                    </td>
                    <td className="px-3 py-2 text-center border border-gray-200">
                      {pct(s.connectedCalls, orgTotals.connectedCalls)}
                    </td>
                    <td className="px-3 py-2 text-center border border-gray-200">
                      {pct(s.totalDurationSec, orgTotals.totalDurationSec)}
                    </td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr className="bg-yellow-50 font-semibold text-gray-800 border-t-2 border-gray-300">
                <td className="px-3 py-2 border border-gray-200">Total</td>
                <td className="px-3 py-2 text-center border border-gray-200">{orgTotals.totalCalls}</td>
                <td className="px-3 py-2 text-center border border-gray-200 text-green-700">
                  {orgTotals.connectedCalls}
                </td>
                <td className="px-3 py-2 text-center border border-gray-200">{fmtDur(orgTotals.totalDurationSec)}</td>
                <td className="px-3 py-2 text-center border border-gray-200">100%</td>
                <td className="px-3 py-2 text-center border border-gray-200">100%</td>
                <td className="px-3 py-2 text-center border border-gray-200">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Employee × Slot summary table ───────────────────────────── */}
      {employees.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Employee Summary</h3>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="text-xs border-collapse" style={{ minWidth: `${200 + SLOTS.length * 180 + 160}px` }}>
              <thead>
                {/* Row 1: slot group headers */}
                <tr className="bg-gray-100 text-gray-700">
                  <th rowSpan={2} className="px-3 py-2 text-left font-semibold border border-gray-200 min-w-[160px] sticky left-0 bg-gray-100 z-10">
                    Employee
                  </th>
                  {SLOTS.map(slot => (
                    <th key={slot.label} colSpan={3}
                      className="px-2 py-1.5 text-center font-semibold border border-gray-200 bg-blue-50 text-blue-800 whitespace-nowrap">
                      {slot.label}
                    </th>
                  ))}
                  {/* Grand total */}
                  <th colSpan={3}
                    className="px-2 py-1.5 text-center font-semibold border border-gray-200 bg-gray-200 text-gray-800">
                    Total
                  </th>
                </tr>
                {/* Row 2: sub-column headers */}
                <tr className="bg-gray-50 text-gray-600">
                  {[...SLOTS, { label: '__total__' }].map(slot => (
                    <>
                      <th key={slot.label + '_tc'} className="px-2 py-1.5 text-center border border-gray-200 min-w-[55px] font-medium">
                        Total Calls
                      </th>
                      <th key={slot.label + '_cc'} className="px-2 py-1.5 text-center border border-gray-200 min-w-[65px] font-medium">
                        Connected
                      </th>
                      <th key={slot.label + '_dur'} className="px-2 py-1.5 text-center border border-gray-200 min-w-[75px] font-medium">
                        Duration
                      </th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => (
                  <tr key={emp.callerId}
                    className={i % 2 === 0 ? 'bg-white hover:bg-yellow-50' : 'bg-gray-50/60 hover:bg-yellow-50'}>
                    {/* Employee name */}
                    <td className="px-3 py-2 border border-gray-200 sticky left-0 bg-inherit z-10">
                      <div className="font-medium text-gray-900">{emp.name}</div>
                      <div className="text-gray-400 text-[10px]">{emp.employeeId}</div>
                    </td>
                    {/* Per-slot cells */}
                    {SLOTS.map(slot => {
                      const s = emp.bySlot[slot.label] ?? emptySlot()
                      return (
                        <>
                          <td key={slot.label + '_tc'} className="px-2 py-2 text-center border border-gray-200">
                            {s.totalCalls || '—'}
                          </td>
                          <td key={slot.label + '_cc'} className="px-2 py-2 text-center border border-gray-200 text-green-700">
                            {s.connectedCalls || '—'}
                          </td>
                          <td key={slot.label + '_dur'} className="px-2 py-2 text-center border border-gray-200 text-gray-500">
                            {s.totalDurationSec ? fmtDur(s.totalDurationSec) : '—'}
                          </td>
                        </>
                      )
                    })}
                    {/* Grand total cells */}
                    <td className="px-2 py-2 text-center border border-gray-200 font-semibold bg-gray-50">
                      {emp.totals.totalCalls}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-200 font-semibold text-green-700 bg-gray-50">
                      {emp.totals.connectedCalls}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-200 bg-gray-50">
                      {fmtDur(emp.totals.totalDurationSec)}
                    </td>
                  </tr>
                ))}

                {/* Org totals row */}
                <tr className="bg-yellow-50 font-semibold border-t-2 border-gray-300">
                  <td className="px-3 py-2 border border-gray-200 sticky left-0 bg-yellow-50 z-10">Total</td>
                  {SLOTS.map(slot => {
                    const s = orgSlots[slot.label] ?? emptySlot()
                    return (
                      <>
                        <td key={slot.label + '_tc'} className="px-2 py-2 text-center border border-gray-200">{s.totalCalls || '—'}</td>
                        <td key={slot.label + '_cc'} className="px-2 py-2 text-center border border-gray-200 text-green-700">{s.connectedCalls || '—'}</td>
                        <td key={slot.label + '_dur'} className="px-2 py-2 text-center border border-gray-200">{s.totalDurationSec ? fmtDur(s.totalDurationSec) : '—'}</td>
                      </>
                    )
                  })}
                  <td className="px-2 py-2 text-center border border-gray-200 bg-gray-100">{orgTotals.totalCalls}</td>
                  <td className="px-2 py-2 text-center border border-gray-200 text-green-700 bg-gray-100">{orgTotals.connectedCalls}</td>
                  <td className="px-2 py-2 text-center border border-gray-200 bg-gray-100">{fmtDur(orgTotals.totalDurationSec)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 3. Calls vs Connected Calls bar chart ──────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-800">Calls vs Connected Calls</h3>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#22c55e]" />Total Calls
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-[#f59e0b]" />Total Connected Calls
            </span>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded p-3">
          {chartData.some(d => d['Total Calls'] > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barCategoryGap="30%" barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="slot"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                />
                <Bar dataKey="Total Calls"     fill="#22c55e" radius={[3,3,0,0]} maxBarSize={40} />
                <Bar dataKey="Connected Calls" fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-sm text-gray-400">
              No call data for the selected period
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {rows.length === 0 && !loading && (
        <div className="text-center py-10 text-gray-400 text-sm">
          No hourly data found for the selected date range.
        </div>
      )}
    </div>
  )
}
