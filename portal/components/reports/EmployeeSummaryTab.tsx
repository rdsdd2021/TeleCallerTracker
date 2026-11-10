'use client'

import { useState, useEffect, useCallback } from 'react'
import { DateRangeForm } from './DateRangeForm'
import { ReportTable } from './ReportTable'
import { CallTypePieChart } from './CallTypePieChart'
import { ExportButton } from '@/components/ExportButton'
import type { EmployeeReportRow, CallTypeDistribution } from '@/types/domain'

interface EmployeeSummaryTabProps {
  orgId: string
  startDate: string
  endDate: string
  onDateRangeChange: (start: string, end: string) => void
}

export function EmployeeSummaryTab({
  orgId,
  startDate,
  endDate,
  onDateRangeChange,
}: EmployeeSummaryTabProps) {
  const [reportData, setReportData] = useState<EmployeeReportRow[]>([])
  const [distribution, setDistribution] = useState<CallTypeDistribution>({
    incoming: 0,
    outgoing: 0,
    missed: 0,
    rejected: 0,
    neverAttended: 0,
    notPickupByClient: 0,
  })
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
      const [reportRes, distributionRes] = await Promise.all([
        fetch(`/api/reports/employee?orgId=${orgId}&start=${startDate}&end=${endDate}`),
        fetch(`/api/reports/distribution?orgId=${orgId}&start=${startDate}&end=${endDate}`),
      ])

      if (!reportRes.ok || !distributionRes.ok) {
        throw new Error('Failed to fetch report data')
      }

      const [employeeReportData, distributionData] = await Promise.all([
        reportRes.json(),
        distributionRes.json(),
      ])

      setReportData(employeeReportData)
      setDistribution(distributionData)
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
      <div className="flex items-end justify-between">
        <DateRangeForm start={startDate} end={endDate} onSubmit={handleDateSubmit} />
        <ExportButton type="reports" orgId={orgId} start={startDate} end={endDate} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold text-primary">
            {reportData.reduce((sum, row) => sum + row.totalCalls, 0)}
          </div>
          <div className="text-sm text-muted-foreground">Total Calls</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">
            {reportData.reduce((sum, row) => sum + row.connectedCalls, 0)}
          </div>
          <div className="text-sm text-muted-foreground">Connected Calls</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">
            {new Set(reportData.flatMap(row => Array(row.uniqueClients).fill(row.callerId))).size}
          </div>
          <div className="text-sm text-muted-foreground">Unique Clients</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-2xl font-bold text-orange-600">
            {Math.round(reportData.reduce((sum, row) => sum + row.workingHoursSec, 0) / 3600)}h
          </div>
          <div className="text-sm text-muted-foreground">Total Working Hours</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Table */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Employee Performance</h3>
              <p className="text-sm text-muted-foreground">
                Detailed breakdown by employee
              </p>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <ReportTable rows={reportData} />
              )}
            </div>
          </div>
        </div>

        {/* Call Distribution Chart */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Call Distribution</h3>
              <p className="text-sm text-muted-foreground">
                Breakdown by call type
              </p>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <CallTypePieChart distribution={distribution} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}