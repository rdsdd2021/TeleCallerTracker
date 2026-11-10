'use client'

import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DateRangeForm } from './DateRangeForm'

interface PeriodicReportsTabProps {
  orgId: string
  startDate: string
  endDate: string
  onDateRangeChange: (start: string, end: string) => void
}

interface DailyMetrics {
  date: string
  totalCalls: number
  incomingCalls: number
  outgoingCalls: number
  missedCalls: number
  connectedCalls: number
  totalDuration: number
}

interface HourlyMetrics {
  hour: string
  calls: number
  avgDuration: number
}

export function PeriodicReportsTab({
  orgId,
  startDate,
  endDate,
  onDateRangeChange,
}: PeriodicReportsTabProps) {
  const [dailyData, setDailyData] = useState<DailyMetrics[]>([])
  const [hourlyData, setHourlyData] = useState<HourlyMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (new Date(startDate) > new Date(endDate)) {
      setError('Start date must be on or before end date.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [dailyRes, hourlyRes] = await Promise.all([
        fetch(`/api/reports/daily?orgId=${orgId}&start=${startDate}&end=${endDate}`),
        fetch(`/api/reports/hourly?orgId=${orgId}&start=${startDate}&end=${endDate}`),
      ])

      if (!dailyRes.ok || !hourlyRes.ok) {
        throw new Error('Failed to fetch periodic data')
      }

      const [dailyMetrics, hourlyMetrics] = await Promise.all([
        dailyRes.json(),
        hourlyRes.json(),
      ])

      setDailyData(dailyMetrics)
      setHourlyData(hourlyMetrics)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [orgId, startDate, endDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDateSubmit = (start: string, end: string) => {
    onDateRangeChange(start, end)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <DateRangeForm start={startDate} end={endDate} onSubmit={handleDateSubmit} />
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <DateRangeForm start={startDate} end={endDate} onSubmit={handleDateSubmit} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Call Volume */}
        <div className="rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Daily Call Volume</h3>
            <p className="text-sm text-muted-foreground">
              Call trends over time
            </p>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalCalls" fill="#f97316" name="Total Calls" />
                  <Bar dataKey="connectedCalls" fill="#22c55e" name="Connected" />
                  <Bar dataKey="missedCalls" fill="#ef4444" name="Missed" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Call Duration Trends */}
        <div className="rounded-lg border">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Call Duration Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Average duration trends
            </p>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="totalDuration" 
                    stroke="#3b82f6" 
                    name="Total Duration (sec)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Hourly Distribution */}
        <div className="rounded-lg border lg:col-span-2">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Hourly Call Distribution</h3>
            <p className="text-sm text-muted-foreground">
              Peak calling hours analysis
            </p>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis yAxisId="calls" orientation="left" />
                  <YAxis yAxisId="duration" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="calls" dataKey="calls" fill="#f97316" name="Number of Calls" />
                  <Line yAxisId="duration" type="monotone" dataKey="avgDuration" stroke="#3b82f6" name="Avg Duration" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-lg font-semibold text-blue-600">
            Peak Hour
          </div>
          <div className="text-2xl font-bold">
            {hourlyData.length > 0 
              ? hourlyData.reduce((max, curr) => curr.calls > max.calls ? curr : max, hourlyData[0])?.hour || 'N/A'
              : 'N/A'
            }
          </div>
          <div className="text-sm text-muted-foreground">Highest call volume</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-lg font-semibold text-green-600">
            Best Day
          </div>
          <div className="text-2xl font-bold">
            {dailyData.length > 0 
              ? dailyData.reduce((max, curr) => curr.totalCalls > max.totalCalls ? curr : max, dailyData[0])?.date || 'N/A'
              : 'N/A'
            }
          </div>
          <div className="text-sm text-muted-foreground">Most productive day</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-lg font-semibold text-orange-600">
            Avg Daily Calls
          </div>
          <div className="text-2xl font-bold">
            {dailyData.length > 0 
              ? Math.round(dailyData.reduce((sum, day) => sum + day.totalCalls, 0) / dailyData.length)
              : 0
            }
          </div>
          <div className="text-sm text-muted-foreground">Per day average</div>
        </div>
      </div>
    </div>
  )
}