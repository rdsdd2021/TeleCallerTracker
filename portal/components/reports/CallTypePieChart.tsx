'use client'

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts'
import type { CallTypeDistribution } from '@/types/domain'

interface CallTypePieChartProps {
  distribution: CallTypeDistribution
}

const SLICES = [
  { key: 'incoming' as const, label: 'Incoming', color: '#22c55e' },
  { key: 'outgoing' as const, label: 'Outgoing', color: '#3b82f6' },
  { key: 'missed' as const, label: 'Missed', color: '#f97316' },
  { key: 'rejected' as const, label: 'Rejected', color: '#ef4444' },
  { key: 'neverAttended' as const, label: 'Never Attended', color: '#a855f7' },
  { key: 'notPickupByClient' as const, label: 'Not Pickup by Client', color: '#eab308' },
]

export function CallTypePieChart({ distribution }: CallTypePieChartProps) {
  const data = SLICES.map(({ key, label, color }) => ({
    name: label,
    value: distribution[key],
    color,
  }))

  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return (
      <p className="text-muted-foreground text-sm py-8 text-center">
        No data for the selected period.
      </p>
    )
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }) =>
              `${name} (${(percent * 100).toFixed(0)}%)`
            }
            labelLine={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => [value, 'Calls']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
