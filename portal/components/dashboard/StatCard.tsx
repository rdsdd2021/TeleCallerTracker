import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: number | string
  delta?: number | null
  formatValue?: (v: number) => string
}

function formatDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toFixed(1)}%`
}

function getDeltaColor(delta: number | null | undefined): string {
  if (delta === null || delta === undefined) return 'text-muted-foreground'
  if (delta > 0) return 'text-green-600'
  if (delta < 0) return 'text-red-600'
  return 'text-muted-foreground'
}

export function StatCard({ label, value, delta, formatValue }: StatCardProps) {
  const displayValue =
    typeof value === 'number' && formatValue ? formatValue(value) : String(value)

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-card-foreground">{displayValue}</p>
      <p className={cn('mt-1 text-xs font-medium', getDeltaColor(delta))}>
        {formatDelta(delta)} vs prior period
      </p>
    </div>
  )
}
