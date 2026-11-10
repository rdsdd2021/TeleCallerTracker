'use client'

import { Download } from 'lucide-react'

interface ExportButtonProps {
  type: 'employees' | 'reports'
  orgId: string
  start?: string
  end?: string
  label?: string
}

export function ExportButton({ type, orgId, start, end, label = 'Export CSV' }: ExportButtonProps) {
  const handleClick = () => {
    const params = new URLSearchParams({ orgId })
    if (start) params.set('start', start)
    if (end) params.set('end', end)
    window.location.href = `/api/export/${type}?${params.toString()}`
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  )
}
