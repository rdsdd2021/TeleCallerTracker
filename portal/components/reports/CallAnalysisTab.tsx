'use client'

import { useState, useEffect, useCallback } from 'react'
import { DateRangeForm } from './DateRangeForm'

interface CallAnalysisTabProps {
  orgId: string
  startDate: string
  endDate: string
  onDateRangeChange: (start: string, end: string) => void
}

interface CallAnalytics {
  totalDuration: {
    highest: { caller: string; duration: number; callId: string }
    longest: { caller: string; duration: number; callId: string }
    average: number
  }
  topPerformers: {
    dialer: { name: string; employeeId: string; totalCalls: number }
    answered: { name: string; employeeId: string; answeredCalls: number }
    caller: { name: string; employeeId: string; uniqueClients: number }
  }
  callPatterns: {
    avgDurationIncoming: number
    avgDurationOutgoing: number
    avgDurationMissed: number
    peakHour: string
    peakDay: string
  }
}

export function CallAnalysisTab({
  orgId,
  startDate,
  endDate,
  onDateRangeChange,
}: CallAnalysisTabProps) {
  const [analytics, setAnalytics] = useState<CallAnalytics | null>(null)
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
      const response = await fetch(`/api/reports/analytics?orgId=${orgId}&start=${startDate}&end=${endDate}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const data = await response.json()
      setAnalytics(data)
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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Mobile Call Analysis */}
          <div className="rounded-lg border">
            <div className="p-4 border-b bg-orange-50">
              <h3 className="font-semibold text-orange-800">📱 Mobile Call Analysis</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="border-l-4 border-orange-400 pl-4">
                <div className="font-medium text-orange-700">Top Dialer</div>
                <div className="text-sm text-gray-600">
                  {analytics.topPerformers.dialer.name} ({analytics.topPerformers.dialer.employeeId})
                </div>
                <div className="text-lg font-bold text-orange-600">
                  Total Calls: {analytics.topPerformers.dialer.totalCalls}
                </div>
              </div>
              
              <div className="border-l-4 border-green-400 pl-4">
                <div className="font-medium text-green-700">Top Answered</div>
                <div className="text-sm text-gray-600">
                  {analytics.topPerformers.answered.name} ({analytics.topPerformers.answered.employeeId})
                </div>
                <div className="text-lg font-bold text-green-600">
                  Answered Calls: {analytics.topPerformers.answered.answeredCalls}
                </div>
              </div>

              <div className="border-l-4 border-blue-400 pl-4">
                <div className="font-medium text-blue-700">Top Caller</div>
                <div className="text-sm text-gray-600">
                  {analytics.topPerformers.caller.name} ({analytics.topPerformers.caller.employeeId})
                </div>
                <div className="text-lg font-bold text-blue-600">
                  Start Calls: {analytics.topPerformers.caller.uniqueClients} (Incoming + Outgoing)
                </div>
              </div>
            </div>
          </div>

          {/* Total Call Duration Analysis */}
          <div className="rounded-lg border">
            <div className="p-4 border-b bg-blue-50">
              <h3 className="font-semibold text-blue-800">⏱️ Total Call Duration Analysis</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="border-l-4 border-red-400 pl-4">
                <div className="font-medium text-red-700">Highest Total Duration</div>
                <div className="text-sm text-gray-600">
                  {analytics.totalDuration.highest.caller}
                </div>
                <div className="text-lg font-bold text-red-600">
                  Duration: {formatDuration(analytics.totalDuration.highest.duration)}
                </div>
              </div>

              <div className="border-l-4 border-purple-400 pl-4">
                <div className="font-medium text-purple-700">Longest Duration</div>
                <div className="text-sm text-gray-600">
                  {analytics.totalDuration.longest.caller}
                </div>
                <div className="text-lg font-bold text-purple-600">
                  Duration: {formatDuration(analytics.totalDuration.longest.duration)}
                </div>
              </div>

              <div className="border-l-4 border-gray-400 pl-4">
                <div className="font-medium text-gray-700">Average Duration per Call</div>
                <div className="text-lg font-bold text-gray-600">
                  {formatDuration(Math.round(analytics.totalDuration.average))}
                </div>
              </div>
            </div>
          </div>

          {/* Average Call Duration Analysis */}
          <div className="rounded-lg border lg:col-span-2">
            <div className="p-4 border-b bg-green-50">
              <h3 className="font-semibold text-green-800">📊 Average Call Duration Analysis of Connected Calls</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatDuration(Math.round(analytics.callPatterns.avgDurationIncoming))}
                  </div>
                  <div className="text-sm font-medium text-blue-700">Average Duration per Incoming Call</div>
                </div>
                
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {formatDuration(Math.round(analytics.callPatterns.avgDurationOutgoing))}
                  </div>
                  <div className="text-sm font-medium text-orange-700">Average Duration per Outgoing Call</div>
                </div>

                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-600">
                    {formatDuration(Math.round(analytics.callPatterns.avgDurationMissed))}
                  </div>
                  <div className="text-sm font-medium text-gray-700">Average Duration per Call</div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <div className="text-sm text-yellow-800">
                  <strong>Note:</strong> Average call durations of incoming calls, outgoing calls, and overall call patterns help identify communication effectiveness and customer engagement levels.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No analytics data available for the selected period.</p>
        </div>
      )}
    </div>
  )
}