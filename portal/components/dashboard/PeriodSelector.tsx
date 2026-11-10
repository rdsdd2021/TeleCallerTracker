'use client'

import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/dashboard/StatCard'
import type { DashboardMetrics, Period } from '@/types/domain'

interface PeriodSelectorProps {
  orgId: string
  initialPeriod: Period
  initialMetrics?: DashboardMetrics
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_week', label: 'Last Week' },
]

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

const STAT_CARDS: {
  label: string
  key: keyof Omit<DashboardMetrics, 'delta'>
  formatValue?: (v: number) => string
}[] = [
  { label: 'Total Calls', key: 'totalCalls' },
  { label: 'Total Call Duration', key: 'totalDurationSec', formatValue: formatDuration },
  { label: 'Incoming Calls', key: 'incomingCalls' },
  { label: 'Outgoing Calls', key: 'outgoingCalls' },
  { label: 'Missed Calls', key: 'missedCalls' },
  { label: 'Rejected Calls', key: 'rejectedCalls' },
  { label: 'Never Attended', key: 'neverAttendedCalls' },
  { label: 'Not Pickup by Client', key: 'notPickupByClientCalls' },
  { label: 'Unique Clients', key: 'uniqueClients' },
  { label: 'Working Hours', key: 'workingHoursSec', formatValue: formatDuration },
  { label: 'Connected Calls', key: 'connectedCalls' },
]

export function PeriodSelector({ orgId, initialPeriod, initialMetrics }: PeriodSelectorProps) {
  const [period, setPeriod] = useState<Period>(initialPeriod)
  const [metrics, setMetrics] = useState<DashboardMetrics | undefined>(initialMetrics)
  const [loading, setLoading] = useState(false)

  const handlePeriodChange = useCallback(
    async (newPeriod: Period) => {
      if (newPeriod === period) return
      setPeriod(newPeriod)
      setLoading(true)
      try {
        const res = await fetch(
          `/api/dashboard?period=${newPeriod}&orgId=${encodeURIComponent(orgId)}`
        )
        if (res.ok) {
          const data: DashboardMetrics = await res.json()
          setMetrics(data)
        }
      } finally {
        setLoading(false)
      }
    },
    [period, orgId]
  )

  return (
    <div className="space-y-4">
      {/* Period buttons */}
      <div className="flex gap-2" role="group" aria-label="Select time period">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => handlePeriodChange(value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-md border font-medium transition-colors',
              period === value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
            aria-pressed={period === value}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stat cards grid — shown only when metrics are available */}
      {metrics && (
        <div
          className={cn(
            'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity',
            loading ? 'opacity-50 pointer-events-none' : 'opacity-100'
          )}
          aria-busy={loading}
        >
          {STAT_CARDS.map(({ label, key, formatValue }) => (
            <StatCard
              key={key}
              label={label}
              value={metrics[key]}
              delta={metrics.delta?.[key]}
              formatValue={formatValue}
            />
          ))}
        </div>
      )}
    </div>
  )
}
