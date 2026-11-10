'use client'

import { useState } from 'react'
import { AudioPlayer } from '@/components/manage/AudioPlayer'

interface Recording {
  id: string
  callerName: string
  contactNumber: string
  callDate: string
  durationSec: number
  storageUrl: string | null
}

interface RecordingsClientProps {
  recordings: Recording[]
  orgId?: string
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function RecordingsClient({ recordings }: RecordingsClientProps) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const filtered = recordings.filter((r) => {
    const date = r.callDate.slice(0, 10)
    if (startDate && date < startDate) return false
    if (endDate && date > endDate) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div className="space-y-1">
          <label htmlFor="rec-start" className="text-sm font-medium">From</label>
          <input
            id="rec-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="rec-end" className="text-sm font-medium">To</label>
          <input
            id="rec-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate('') }}
            className="px-3 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Caller</th>
              <th className="px-4 py-3 text-left font-medium">Contact Number</th>
              <th className="px-4 py-3 text-left font-medium">Call Date</th>
              <th className="px-4 py-3 text-left font-medium">Duration</th>
              <th className="px-4 py-3 text-left font-medium">Recording</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No recordings found for the selected date range.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">{r.callerName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.contactNumber}</td>
                  <td className="px-4 py-3">{new Date(r.callDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{formatDuration(r.durationSec)}</td>
                  <td className="px-4 py-3">
                    {r.storageUrl ? (
                      <AudioPlayer src={r.storageUrl} />
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Recording unavailable</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
