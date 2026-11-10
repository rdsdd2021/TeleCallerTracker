'use client'

import { useState, useCallback, useEffect } from 'react'
import { AdvancedFiltersPanel, type FilterOptions } from './AdvancedFiltersPanel'
import { KPIDashboard, type KPIData } from './KPIDashboard'
import { PremiumChartsGrid } from './PremiumChartsGrid'
import { DetailedDataTable, type TableRow } from './DetailedDataTable'

interface PremiumReportsContainerProps {
  orgId: string
}

// Mock data - replace with actual API calls
const mockEmployees = [
  { id: '1', name: 'Ramanuj Dey Sarkar', employeeId: 'RDS2197' },
  { id: '2', name: 'Sourav Bhowmick', employeeId: 'The God' },
]

const mockKPIData: KPIData = {
  totalCalls: { value: 1247, change: 12.5, trend: 'up' },
  connectedCalls: { value: 892, change: 8.3, trend: 'up' },
  connectionRate: { value: 71.5, change: -2.1, trend: 'down' },
  avgCallDuration: { value: 185, change: 5.7, trend: 'up' },
  totalTalkTime: { value: 164920, change: 15.2, trend: 'up' },
  activeEmployees: { value: 12, change: 0, trend: 'neutral' },
  uniqueClients: { value: 456, change: 18.9, trend: 'up' },
  peakHourCalls: { value: 89, change: -5.2, trend: 'down' },
  firstCallResolution: { value: 78.3, change: 3.4, trend: 'up' },
  avgResponseTime: { value: 23, change: -12.8, trend: 'up' },
  employeeEfficiency: { value: 82.1, change: 6.7, trend: 'up' },
  callsPerEmployee: { value: 103.9, change: 12.5, trend: 'up' },
}

const mockChartData = {
  dailyTrends: [
    { date: '2024-01-01', totalCalls: 120, connectedCalls: 85, missedCalls: 35, avgDuration: 180 },
    { date: '2024-01-02', totalCalls: 135, connectedCalls: 98, missedCalls: 37, avgDuration: 195 },
    { date: '2024-01-03', totalCalls: 142, connectedCalls: 102, missedCalls: 40, avgDuration: 175 },
    { date: '2024-01-04', totalCalls: 128, connectedCalls: 89, missedCalls: 39, avgDuration: 188 },
    { date: '2024-01-05', totalCalls: 156, connectedCalls: 112, missedCalls: 44, avgDuration: 192 },
  ],
  hourlyDistribution: [
    { hour: '09:00', calls: 45, avgDuration: 180, efficiency: 75 },
    { hour: '10:00', calls: 62, avgDuration: 195, efficiency: 82 },
    { hour: '11:00', calls: 78, avgDuration: 175, efficiency: 88 },
    { hour: '12:00', calls: 52, avgDuration: 165, efficiency: 70 },
    { hour: '13:00', calls: 38, avgDuration: 155, efficiency: 65 },
    { hour: '14:00', calls: 69, avgDuration: 185, efficiency: 85 },
    { hour: '15:00', calls: 84, avgDuration: 190, efficiency: 90 },
    { hour: '16:00', calls: 71, avgDuration: 180, efficiency: 78 },
  ],
  callTypeDistribution: [
    { name: 'Incoming', value: 456, color: '#3B82F6' },
    { name: 'Outgoing', value: 623, color: '#10B981' },
    { name: 'Missed', value: 168, color: '#EF4444' },
  ],
  employeePerformance: [
    { name: 'Ramanuj', calls: 145, connected: 102, efficiency: 85, avgDuration: 195 },
    { name: 'Sourav', calls: 132, connected: 98, efficiency: 82, avgDuration: 180 },
  ],
  weeklyComparison: [
    { week: 'Week 1', thisWeek: 1247, lastWeek: 1108, growth: 12.5 },
    { week: 'Week 2', thisWeek: 1356, lastWeek: 1247, growth: 8.7 },
  ],
  durationAnalysis: [
    { range: '0-30s', count: 156, percentage: 25 },
    { range: '30s-2m', count: 234, percentage: 35 },
    { range: '2m-5m', count: 189, percentage: 30 },
    { range: '5m+', count: 78, percentage: 10 },
  ],
}

const mockTableData: TableRow[] = [
  {
    id: '1',
    employeeName: 'Ramanuj Dey Sarkar',
    employeeId: 'RDS2197',
    totalCalls: 145,
    connectedCalls: 102,
    missedCalls: 43,
    connectionRate: 70.3,
    avgDuration: 195,
    totalDuration: 19890,
    uniqueClients: 78,
    peakHour: '15:00',
    efficiency: 85.2,
    firstCallResolution: 78.5,
    avgResponseTime: 18,
    lastCallTime: '2024-01-05T16:30:00Z',
    status: 'active',
  },
  {
    id: '2',
    employeeName: 'Sourav Bhowmick',
    employeeId: 'The God',
    totalCalls: 132,
    connectedCalls: 98,
    missedCalls: 34,
    connectionRate: 74.2,
    avgDuration: 180,
    totalDuration: 17640,
    uniqueClients: 65,
    peakHour: '14:00',
    efficiency: 82.1,
    firstCallResolution: 81.2,
    avgResponseTime: 22,
    lastCallTime: '2024-01-05T17:15:00Z',
    status: 'active',
  },
]

export function PremiumReportsContainer({ orgId: _orgId }: PremiumReportsContainerProps) {
  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: {
      start: new Date().toISOString().slice(0, 10),
      end: new Date().toISOString().slice(0, 10),
      preset: 'today',
    },
    employees: [],
    callTypes: [],
    durationRange: { min: 0, max: 3600 },
    timeRange: { start: '00:00', end: '23:59' },
    clientSearch: '',
    showOnlyConnected: false,
  })

  const [isLoading, setIsLoading] = useState(false)
  const [kpiData, setKpiData] = useState<KPIData>(mockKPIData)
  const [chartData, setChartData] = useState(mockChartData)
  const [tableData, setTableData] = useState<TableRow[]>(mockTableData)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // TODO: Replace with actual API calls
      // const [kpiResponse, chartResponse, tableResponse] = await Promise.all([
      //   fetch(`/api/reports/kpi?${new URLSearchParams(filterParams)}`),
      //   fetch(`/api/reports/charts?${new URLSearchParams(filterParams)}`),
      //   fetch(`/api/reports/table?${new URLSearchParams(filterParams)}`),
      // ])
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Mock data updates based on filters
      setKpiData(mockKPIData)
      setChartData(mockChartData)
      setTableData(mockTableData)
    } catch (error) {
      console.error('Error fetching reports data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleFiltersChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters)
  }, [])

  const handleExport = useCallback(() => {
    // TODO: Implement export functionality
    console.log('Exporting data with filters:', filters)
  }, [filters])

  const handleRefresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  const handleViewDetails = useCallback((employeeId: string) => {
    // TODO: Navigate to employee details page
    console.log('Viewing details for employee:', employeeId)
  }, [])

  return (
    <div className="space-y-8 p-6 bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Premium Reports Dashboard</h1>
            <p className="text-lg text-gray-600 mt-2">
              Comprehensive analytics and insights for your call center operations
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-500">Last Updated</div>
              <div className="text-sm font-medium text-gray-900">
                {new Date().toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <AdvancedFiltersPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        employees={mockEmployees}
        onExport={handleExport}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      {/* KPI Dashboard */}
      <KPIDashboard data={kpiData} isLoading={isLoading} />

      {/* Charts Grid */}
      <PremiumChartsGrid data={chartData} isLoading={isLoading} />

      {/* Detailed Data Table */}
      <DetailedDataTable
        data={tableData}
        isLoading={isLoading}
        onExport={handleExport}
        onViewDetails={handleViewDetails}
      />

      {/* Performance Insights */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">📈 Top Performer</h4>
            <p className="text-sm text-blue-800">
              Ramanuj Dey Sarkar leads with 85.2% efficiency and 145 total calls this period.
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h4 className="font-medium text-green-900 mb-2">🎯 Best Connection Rate</h4>
            <p className="text-sm text-green-800">
              Sourav Bhowmick achieved 74.2% connection rate, above team average.
            </p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
            <h4 className="font-medium text-orange-900 mb-2">⏰ Peak Performance</h4>
            <p className="text-sm text-orange-800">
              Highest call volume occurs between 2-3 PM with 90% efficiency rate.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}