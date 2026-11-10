'use client'

import { useState, useCallback } from 'react'
import { Calendar, Filter, X, Download, RefreshCw, Users, Clock, Phone, Search } from 'lucide-react'

export interface FilterOptions {
  dateRange: {
    start: string
    end: string
    preset: string
  }
  employees: string[]
  callTypes: string[]
  durationRange: {
    min: number
    max: number
  }
  timeRange: {
    start: string
    end: string
  }
  clientSearch: string
  showOnlyConnected: boolean
}

interface AdvancedFiltersPanelProps {
  filters: FilterOptions
  onFiltersChange: (filters: FilterOptions) => void
  employees: Array<{ id: string; name: string; employeeId: string }>
  onExport: () => void
  onRefresh: () => void
  isLoading?: boolean
}

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last7days' },
  { label: 'Last 30 days', value: 'last30days' },
  { label: 'This Month', value: 'thismonth' },
  { label: 'Last Month', value: 'lastmonth' },
  { label: 'Custom Range', value: 'custom' },
]

const CALL_TYPES = [
  { label: 'Incoming', value: 'incoming', color: 'bg-blue-100 text-blue-800' },
  { label: 'Outgoing', value: 'outgoing', color: 'bg-green-100 text-green-800' },
  { label: 'Missed', value: 'missed', color: 'bg-red-100 text-red-800' },
  { label: 'Rejected', value: 'rejected', color: 'bg-orange-100 text-orange-800' },
  { label: 'Never Attended', value: 'never_attended', color: 'bg-gray-100 text-gray-800' },
  { label: 'Not Pickup by Client', value: 'not_pickup_by_client', color: 'bg-purple-100 text-purple-800' },
]

export function AdvancedFiltersPanel({
  filters,
  onFiltersChange,
  employees,
  onExport,
  onRefresh,
  isLoading = false,
}: AdvancedFiltersPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getDateRangeFromPreset = useCallback((preset: string) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    
    switch (preset) {
      case 'today':
        return {
          start: today.toISOString().slice(0, 10),
          end: today.toISOString().slice(0, 10),
        }
      case 'yesterday':
        return {
          start: yesterday.toISOString().slice(0, 10),
          end: yesterday.toISOString().slice(0, 10),
        }
      case 'last7days':
        const last7 = new Date(today)
        last7.setDate(last7.getDate() - 7)
        return {
          start: last7.toISOString().slice(0, 10),
          end: today.toISOString().slice(0, 10),
        }
      case 'last30days':
        const last30 = new Date(today)
        last30.setDate(last30.getDate() - 30)
        return {
          start: last30.toISOString().slice(0, 10),
          end: today.toISOString().slice(0, 10),
        }
      case 'thismonth':
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        return {
          start: thisMonthStart.toISOString().slice(0, 10),
          end: today.toISOString().slice(0, 10),
        }
      case 'lastmonth':
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        return {
          start: lastMonthStart.toISOString().slice(0, 10),
          end: lastMonthEnd.toISOString().slice(0, 10),
        }
      default:
        return { start: filters.dateRange.start, end: filters.dateRange.end }
    }
  }, [filters.dateRange])

  const handlePresetChange = useCallback((preset: string) => {
    const dateRange = getDateRangeFromPreset(preset)
    onFiltersChange({
      ...filters,
      dateRange: {
        ...dateRange,
        preset,
      },
    })
  }, [filters, onFiltersChange, getDateRangeFromPreset])

  const handleEmployeeToggle = useCallback((employeeId: string) => {
    const newEmployees = filters.employees.includes(employeeId)
      ? filters.employees.filter(id => id !== employeeId)
      : [...filters.employees, employeeId]
    
    onFiltersChange({
      ...filters,
      employees: newEmployees,
    })
  }, [filters, onFiltersChange])

  const handleCallTypeToggle = useCallback((callType: string) => {
    const newCallTypes = filters.callTypes.includes(callType)
      ? filters.callTypes.filter(type => type !== callType)
      : [...filters.callTypes, callType]
    
    onFiltersChange({
      ...filters,
      callTypes: newCallTypes,
    })
  }, [filters, onFiltersChange])

  const clearAllFilters = useCallback(() => {
    onFiltersChange({
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
  }, [onFiltersChange])

  const activeFiltersCount = 
    (filters.employees.length > 0 ? 1 : 0) +
    (filters.callTypes.length > 0 ? 1 : 0) +
    (filters.clientSearch ? 1 : 0) +
    (filters.showOnlyConnected ? 1 : 0) +
    (filters.durationRange.min > 0 || filters.durationRange.max < 3600 ? 1 : 0) +
    (filters.timeRange.start !== '00:00' || filters.timeRange.end !== '23:59' ? 1 : 0)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Filter className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
              <p className="text-sm text-gray-500">
                Customize your report view with detailed filtering options
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                {activeFiltersCount} active
              </span>
            )}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {isExpanded ? 'Collapse' : 'Expand'} Filters
            </button>
          </div>
        </div>
      </div>

      {/* Quick Date Presets - Always Visible */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Date Range</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handlePresetChange(preset.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                filters.dateRange.preset === preset.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
        
        {filters.dateRange.preset === 'custom' && (
          <div className="flex gap-3 mt-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.dateRange.start}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  dateRange: { ...filters.dateRange, start: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
              <input
                type="date"
                value={filters.dateRange.end}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  dateRange: { ...filters.dateRange, end: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons - Always Visible */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Loading...' : 'Apply Filters'}
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export Data
            </button>
          </div>
          {activeFiltersCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
            >
              <X className="h-4 w-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters */}
      {isExpanded && (
        <div className="px-6 py-6 space-y-6">
          {/* Employee Selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Employees</span>
              {filters.employees.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {filters.employees.length} selected
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {employees.map((employee) => (
                <label
                  key={employee.id}
                  className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.employees.includes(employee.id)}
                    onChange={() => handleEmployeeToggle(employee.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {employee.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {employee.employeeId}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Call Types */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Phone className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Call Types</span>
              {filters.callTypes.length > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {filters.callTypes.length} selected
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {CALL_TYPES.map((callType) => (
                <button
                  key={callType.value}
                  onClick={() => handleCallTypeToggle(callType.value)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filters.callTypes.includes(callType.value)
                      ? callType.color
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {callType.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration Range */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Call Duration Range</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Min Duration (seconds)</label>
                <input
                  type="number"
                  min="0"
                  max="3600"
                  value={filters.durationRange.min}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    durationRange: { ...filters.durationRange, min: parseInt(e.target.value, 10) || 0 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Max Duration (seconds)</label>
                <input
                  type="number"
                  min="0"
                  max="3600"
                  value={filters.durationRange.max}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    durationRange: { ...filters.durationRange, max: parseInt(e.target.value, 10) || 3600 }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Time Range */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Time of Day Range</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start Time</label>
                <input
                  type="time"
                  value={filters.timeRange.start}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    timeRange: { ...filters.timeRange, start: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End Time</label>
                <input
                  type="time"
                  value={filters.timeRange.end}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    timeRange: { ...filters.timeRange, end: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Client Search */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Search className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Client Number Search</span>
            </div>
            <input
              type="text"
              placeholder="Search by client phone number..."
              value={filters.clientSearch}
              onChange={(e) => onFiltersChange({
                ...filters,
                clientSearch: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Additional Options */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-gray-700">Additional Options</span>
            </div>
            <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={filters.showOnlyConnected}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  showOnlyConnected: e.target.checked
                })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">Show Only Connected Calls</div>
                <div className="text-xs text-gray-500">Filter out missed, rejected, and unanswered calls</div>
              </div>
            </label>
          </div>
        </div>
      )}
    </div>
  )
}