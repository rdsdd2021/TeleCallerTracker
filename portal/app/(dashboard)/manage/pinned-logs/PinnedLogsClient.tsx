'use client'

import { useTransition } from 'react'
import { unpinCallLogAction } from './actions'

interface PinnedLog {
  id: string
  callerName: string
  contactNumber: string
  callType: string
  durationSec: number
  callDate: string
  pinnedByUserId: string
}

interface PinnedLogsClientProps {
  logs: PinnedLog[]
  canManage: boolean
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatCallType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function PinnedLogsClient({ logs, canManage }: PinnedLogsClientProps) {
  const [isPending, startTransition] = useTransition()

  const handleUnpin = (id: string) => {
    startTransition(async () => {
      await unpinCallLogAction(id)
    })
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-medium">Caller</th>
            <th className="px-4 py-3 text-left font-medium">Contact Number</th>
            <th className="px-4 py-3 text-left font-medium">Call Type</th>
            <th className="px-4 py-3 text-left font-medium">Duration</th>
            <th className="px-4 py-3 text-left font-medium">Call Date</th>
            <th className="px-4 py-3 text-left font-medium">Pinned By</th>
            {canManage && <th className="px-4 py-3 text-left font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={canManage ? 7 : 6} className="px-4 py-8 text-center text-muted-foreground">
                No pinned call logs yet.
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">{log.callerName}</td>
                <td className="px-4 py-3 font-mono text-xs">{log.contactNumber}</td>
                <td className="px-4 py-3">{formatCallType(log.callType)}</td>
                <td className="px-4 py-3">{formatDuration(log.durationSec)}</td>
                <td className="px-4 py-3">{new Date(log.callDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{log.pinnedByUserId}</td>
                {canManage && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleUnpin(log.id)}
                      disabled={isPending}
                      className="text-xs text-destructive hover:underline disabled:opacity-50"
                    >
                      Unpin
                    </button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
