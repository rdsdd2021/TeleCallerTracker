'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

interface DateRangeFormProps {
  start: string
  end: string
  onSubmit?: (start: string, end: string) => void
}

export function DateRangeForm({ start, end, onSubmit }: DateRangeFormProps) {
  const router = useRouter()
  const [startVal, setStartVal] = useState(start)
  const [endVal, setEndVal] = useState(end)

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (onSubmit) {
        onSubmit(startVal, endVal)
      } else {
        const params = new URLSearchParams({ start: startVal, end: endVal })
        router.push(`/reports?${params.toString()}`)
      }
    },
    [router, startVal, endVal, onSubmit]
  )

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3"
      aria-label="Date range filter"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="report-start" className="text-sm font-medium text-muted-foreground">
          Start date
        </label>
        <input
          id="report-start"
          type="date"
          value={startVal}
          onChange={(e) => setStartVal(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="report-end" className="text-sm font-medium text-muted-foreground">
          End date
        </label>
        <input
          id="report-end"
          type="date"
          value={endVal}
          onChange={(e) => setEndVal(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
      >
        Apply
      </button>
    </form>
  )
}
