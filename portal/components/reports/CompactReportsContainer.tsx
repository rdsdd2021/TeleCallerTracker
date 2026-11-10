'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Download, RefreshCw, Search, ChevronDown, RotateCcw } from 'lucide-react'
import {
  BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, Line,
} from 'recharts'
import { HourlyAnalysisTab } from './HourlyAnalysisTab'

type TabId = 'summary' | 'analysis' | 'daywise' | 'hourly' | 'never_attended' | 'no_pickup' | 'unique_clients' | 'call_history'

const TABS: { id: TabId; label: string }[] = [
  { id: 'summary',        label: 'All Summary' },
  { id: 'analysis',       label: 'Analysis' },
  { id: 'daywise',        label: 'Day-wise Analysis' },
  { id: 'hourly',         label: 'Hourly Analysis' },
  { id: 'never_attended', label: 'Never Attended' },
  { id: 'no_pickup',      label: 'No. Pickup by Client' },
  { id: 'unique_clients', label: 'Unique Clients' },
  { id: 'call_history',   label: 'Call History' },
]
interface CompactReportsContainerProps { orgId: string }
interface FilterOptions {
  dateRange: { start: string; end: string; preset: string }
  employees: string[]
  callTypes: string[]
  durationRange: { min: number; max: number }
  timeRange: { start: string; end: string }
  clientSearch: string
  showOnlyConnected: boolean
}
interface Employee { id: string; name: string; employeeId: string }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface KPIMetric { label: string } // kept for future use
interface EmployeeRow {
  id: string; name: string; employeeId: string
  totalCalls: number; totalDuration: number
  connectedCalls: number; connectedCallsDuration: number; connectedCallsAvgDuration: number
  workingHours: number; uniqueClients: number; uniqueConnectedCalls: number
  incoming: number; outgoing: number; missed: number; rejected: number
  neverAttended: number; notPickupByClient: number; lastSyncTime: string
  todayTotalCalls: number; todayTotalDuration: number
  todayConnectedCalls: number; todayConnectedCallsDuration: number; todayConnectedCallsAvgDuration: number
  weekTotalCalls: number; weekTotalDuration: number
  weekConnectedCalls: number; weekConnectedCallsDuration: number; weekConnectedCallsAvgDuration: number
  incomingTotalCalls: number; incomingTotalDuration: number
  incomingConnectedCalls: number; incomingConnectedCallsDuration: number; incomingConnectedCallsAvgDuration: number
  outgoingTotalCalls: number; outgoingTotalDuration: number
  outgoingConnectedCalls: number; outgoingConnectedCallsDuration: number; outgoingConnectedCallsAvgDuration: number
  status: 'active' | 'inactive' | 'break'
}

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last7days' },
  { label: 'Last 30 days', value: 'last30days' },
  { label: 'This Month', value: 'thismonth' },
]
const CALL_TYPES = [
  { label: 'Incoming', value: 'incoming' },
  { label: 'Outgoing', value: 'outgoing' },
  { label: 'Missed', value: 'missed' },
  { label: 'Rejected', value: 'rejected' },
]
const COLORS = ['#22c55e', '#f97316', '#ef4444', '#a855f7', '#3B82F6', '#EC4899']
const fmtDur = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60)
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// ── CheckboxDropdown ──────────────────────────────────────────────────────────
interface DropdownOption { label: string; value: string }

function CheckboxDropdown({
  options,
  selected,
  onChange,
  searchable = false,
}: {
  label?: string
  options: DropdownOption[]
  selected: string[]
  onChange: (values: string[]) => void
  searchable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value])
  }

  const displayLabel = selected.length === 0
    ? 'Select'
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label ?? 'Select')
      : `${selected.length} selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-500 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-400 min-w-[140px]"
      >
        <span className={selected.length > 0 ? 'text-gray-800' : 'text-gray-400'}>{displayLabel}</span>
        <ChevronDown className={"h-4 w-4 text-gray-400 transition-transform " + (open ? 'rotate-180' : '')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[200px] bg-white border border-gray-200 rounded shadow-lg">
          {searchable && (
            <div className="px-3 py-2 border-b border-gray-100">
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full text-sm text-orange-500 placeholder-orange-300 outline-none"
                autoFocus
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">No options</div>
            ) : (
              filtered.map(opt => (
                <label key={opt.value} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="h-4 w-4 rounded border-orange-300 text-orange-500 focus:ring-orange-400 accent-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── FilterBar ─────────────────────────────────────────────────────────────────
const CALL_METHOD_OPTIONS: DropdownOption[] = [
  { label: 'Mobile', value: 'mobile' },
  { label: 'SIM 1', value: 'sim1' },
  { label: 'SIM 2', value: 'sim2' },
]
const DURATION_OPTIONS: DropdownOption[] = [
  { label: 'Greater than', value: 'gt' },
  { label: 'Less than', value: 'lt' },
  { label: 'Between', value: 'between' },
]
const CALL_TIME_OPTIONS: DropdownOption[] = [
  { label: 'Morning (6am–12pm)', value: 'morning' },
  { label: 'Afternoon (12pm–6pm)', value: 'afternoon' },
  { label: 'Evening (6pm–10pm)', value: 'evening' },
  { label: 'Night (10pm–6am)', value: 'night' },
]

// Duration type → single value (gt/lt) or range (between)
type DurationType = 'gt' | 'lt' | 'between' | ''

function FilterBar({
  filters,
  setFilters,
  employees,
  isLoading,
  onRefresh,
  onPreset,
}: {
  filters: FilterOptions
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>
  employees: Employee[]
  isLoading: boolean
  onRefresh: () => void
  onPreset: (preset: string) => void
}) {
  const [callMethods, setCallMethods] = useState<string[]>([])
  // durationType drives which input(s) appear
  const [durationType, setDurationType] = useState<DurationType>('')
  // raw input values (seconds)
  const [durVal, setDurVal] = useState('')
  const [durValMax, setDurValMax] = useState('')

  const employeeOptions: DropdownOption[] = employees.map(e => ({ label: e.name, value: e.id }))

  // When duration type changes, reset the range
  const handleDurationTypeChange = (vals: string[]) => {
    // Only allow one selection at a time
    const latest = vals[vals.length - 1] as DurationType | undefined
    const next: DurationType = latest ?? ''
    setDurationType(next)
    setDurVal('')
    setDurValMax('')
    // Reset filter range
    setFilters(prev => ({ ...prev, durationRange: { min: 0, max: 3600 } }))
  }

  // Apply duration to filter state
  const applyDuration = () => {
    const v = parseInt(durVal, 10) || 0
    const vMax = parseInt(durValMax, 10) || 3600
    if (durationType === 'gt') {
      setFilters(prev => ({ ...prev, durationRange: { min: v, max: 86400 } }))
    } else if (durationType === 'lt') {
      setFilters(prev => ({ ...prev, durationRange: { min: 0, max: v } }))
    } else if (durationType === 'between') {
      setFilters(prev => ({ ...prev, durationRange: { min: v, max: vMax } }))
    }
  }

  // Map call time selections to timeRange
  const handleCallTimeChange = (vals: string[]) => {
    if (vals.length === 0) {
      setFilters(prev => ({ ...prev, timeRange: { start: '00:00', end: '23:59' } }))
      return
    }
    // Use the first selected time slot
    const slot = vals[0]
    const ranges: Record<string, { start: string; end: string }> = {
      morning:   { start: '06:00', end: '12:00' },
      afternoon: { start: '12:00', end: '18:00' },
      evening:   { start: '18:00', end: '22:00' },
      night:     { start: '22:00', end: '06:00' },
    }
    setFilters(prev => ({ ...prev, timeRange: ranges[slot] ?? { start: '00:00', end: '23:59' } }))
  }

  // Derive selected call time from current timeRange
  const selectedCallTime = (() => {
    const { start } = filters.timeRange
    if (start === '06:00') return ['morning']
    if (start === '12:00') return ['afternoon']
    if (start === '18:00') return ['evening']
    if (start === '22:00') return ['night']
    return []
  })()

  const handleReset = () => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    setFilters({
      dateRange: { start: start.toISOString(), end: end.toISOString(), preset: 'today' },
      employees: [], callTypes: [],
      durationRange: { min: 0, max: 3600 },
      timeRange: { start: '00:00', end: '23:59' },
      clientSearch: '', showOnlyConnected: false,
    })
    setCallMethods([])
    setDurationType('')
    setDurVal('')
    setDurValMax('')
  }

  const inputCls = "px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-orange-400 w-24"

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Title row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b">
        <h1 className="text-base font-semibold text-gray-800">Periodic Reports</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded hover:bg-gray-50 text-gray-600">
            <Download className="h-3.5 w-3.5" />Export
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-3 space-y-3">
        {/* Row 1: From Date · To Date · Employees · Call Type */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">From Date</label>
            <div className="flex gap-1">
              <input type="date" value={filters.dateRange.start.slice(0, 10)}
                onChange={e => { const d = new Date(e.target.value); setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0).toISOString(), preset: 'custom' } })) }}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs w-32 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <input type="time" value={filters.timeRange.start}
                onChange={e => setFilters(prev => ({ ...prev, timeRange: { ...prev.timeRange, start: e.target.value } }))}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs w-24 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">To Date</label>
            <div className="flex gap-1">
              <input type="date" value={filters.dateRange.end.slice(0, 10)}
                onChange={e => { const d = new Date(e.target.value); setFilters(prev => ({ ...prev, dateRange: { ...prev.dateRange, end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString(), preset: 'custom' } })) }}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs w-32 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              <input type="time" value={filters.timeRange.end}
                onChange={e => setFilters(prev => ({ ...prev, timeRange: { ...prev.timeRange, end: e.target.value } }))}
                className="px-2 py-1.5 border border-gray-300 rounded text-xs w-24 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </div>

          <div className="flex flex-col gap-1 min-w-[180px] flex-1">
            <label className="text-xs text-gray-500">Select Employees</label>
            <CheckboxDropdown
              options={employeeOptions.length > 0 ? employeeOptions : [{ label: 'No employees yet', value: '__none__' }]}
              selected={filters.employees}
              onChange={vals => setFilters(prev => ({ ...prev, employees: vals.filter(v => v !== '__none__') }))}
              searchable
            />
          </div>

          <div className="flex flex-col gap-1 min-w-[150px] flex-1">
            <label className="text-xs text-gray-500">Select Call Type</label>
            <CheckboxDropdown
              options={CALL_TYPES}
              selected={filters.callTypes}
              onChange={vals => setFilters(prev => ({ ...prev, callTypes: vals }))}
            />
          </div>
        </div>

        {/* Row 2: Call Method · Duration · Call Time · Apply/Reset */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-[140px] flex-1">
            <label className="text-xs text-gray-500">Select Call Method</label>
            <CheckboxDropdown
              options={CALL_METHOD_OPTIONS}
              selected={callMethods}
              onChange={setCallMethods}
            />
          </div>

          {/* Duration: dropdown + conditional inputs */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500">Select Duration</label>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="min-w-[150px]">
                <CheckboxDropdown
                  options={DURATION_OPTIONS}
                  selected={durationType ? [durationType] : []}
                  onChange={handleDurationTypeChange}
                  searchable
                />
              </div>
              {/* Greater than / Less than: single input */}
              {(durationType === 'gt' || durationType === 'lt') && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    placeholder="seconds"
                    value={durVal}
                    onChange={e => { setDurVal(e.target.value); }}
                    onBlur={applyDuration}
                    className={inputCls}
                  />
                  <span className="text-xs text-gray-400">sec</span>
                </div>
              )}
              {/* Between: two inputs */}
              {durationType === 'between' && (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    placeholder="min"
                    value={durVal}
                    onChange={e => setDurVal(e.target.value)}
                    onBlur={applyDuration}
                    className={inputCls}
                  />
                  <span className="text-xs text-gray-400">–</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="max"
                    value={durValMax}
                    onChange={e => setDurValMax(e.target.value)}
                    onBlur={applyDuration}
                    className={inputCls}
                  />
                  <span className="text-xs text-gray-400">sec</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 min-w-[150px] flex-1">
            <label className="text-xs text-gray-500">Select Call Time</label>
            <CheckboxDropdown
              options={CALL_TIME_OPTIONS}
              selected={selectedCallTime}
              onChange={handleCallTimeChange}
            />
          </div>

          {/* Apply + Reset */}
          <div className="flex gap-2 pb-0.5">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={"h-3.5 w-3.5 " + (isLoading ? 'animate-spin' : '')} />
              Apply
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Date preset pills */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
          {DATE_PRESETS.map(p => (
            <button key={p.value} onClick={() => onPreset(p.value)}
              className={"px-3 py-1 text-xs rounded-full border transition-colors " +
                (filters.dateRange.preset === p.value
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-500')}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function CompactReportsContainer({ orgId: _orgId }: CompactReportsContainerProps) {
  const [filters, setFilters] = useState<FilterOptions>(() => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    return {
      dateRange: { start: start.toISOString(), end: end.toISOString(), preset: 'today' },
      employees: [], callTypes: [],
      durationRange: { min: 0, max: 3600 },
      timeRange: { start: '00:00', end: '23:59' },
      clientSearch: '', showOnlyConnected: false,
    }
  })

  const [isLoading, setIsLoading]   = useState(false)
  const [employees, setEmployees]   = useState<Employee[]>([])
  const [tableData, setTableData]   = useState<EmployeeRow[]>([])
  const [chartData, setChartData]   = useState<any>({})
  const [activeTab, setActiveTab]   = useState<TabId>('summary')

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/employees')
      if (res.ok) {
        const data = await res.json()
        setEmployees(data.map((e: any) => ({ id: e.id, name: e.name, employeeId: e.employee_id })))
      }
    } catch { /* ignore */ }
  }, [])
  const MOCK_ROWS: EmployeeRow[] = [
    {
      id:'1', name:'Ramanuj Dey Sarkar', employeeId:'RDS2197', status:'active',
      totalCalls:145, totalDuration:19890, connectedCalls:102, connectedCallsDuration:15680, connectedCallsAvgDuration:154,
      workingHours:8, uniqueClients:78, uniqueConnectedCalls:95,
      incoming:89, outgoing:56, missed:23, rejected:12, neverAttended:8, notPickupByClient:15,
      lastSyncTime: new Date().toISOString(),
      todayTotalCalls:25, todayTotalDuration:3200, todayConnectedCalls:18, todayConnectedCallsDuration:2400, todayConnectedCallsAvgDuration:133,
      weekTotalCalls:145, weekTotalDuration:19890, weekConnectedCalls:102, weekConnectedCallsDuration:15680, weekConnectedCallsAvgDuration:154,
      incomingTotalCalls:89, incomingTotalDuration:12000, incomingConnectedCalls:65, incomingConnectedCallsDuration:9800, incomingConnectedCallsAvgDuration:150,
      outgoingTotalCalls:56, outgoingTotalDuration:7890, outgoingConnectedCalls:37, outgoingConnectedCallsDuration:5880, outgoingConnectedCallsAvgDuration:159,
    },
    {
      id:'2', name:'Sourav Bhowmick', employeeId:'The God', status:'active',
      totalCalls:198, totalDuration:24560, connectedCalls:156, connectedCallsDuration:20340, connectedCallsAvgDuration:130,
      workingHours:8, uniqueClients:92, uniqueConnectedCalls:148,
      incoming:112, outgoing:86, missed:28, rejected:14, neverAttended:6, notPickupByClient:22,
      lastSyncTime: new Date().toISOString(),
      todayTotalCalls:32, todayTotalDuration:4100, todayConnectedCalls:26, todayConnectedCallsDuration:3380, todayConnectedCallsAvgDuration:130,
      weekTotalCalls:198, weekTotalDuration:24560, weekConnectedCalls:156, weekConnectedCallsDuration:20340, weekConnectedCallsAvgDuration:130,
      incomingTotalCalls:112, incomingTotalDuration:15000, incomingConnectedCalls:89, incomingConnectedCallsDuration:12500, incomingConnectedCallsAvgDuration:140,
      outgoingTotalCalls:86, outgoingTotalDuration:9560, outgoingConnectedCalls:67, outgoingConnectedCallsDuration:7840, outgoingConnectedCallsAvgDuration:117,
    },
  ]

  const fetchReportsData = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        start: filters.dateRange.start, end: filters.dateRange.end,
        employees: filters.employees.join(','), callTypes: filters.callTypes.join(','),
        showOnlyConnected: filters.showOnlyConnected.toString(),
        durationMin: filters.durationRange.min.toString(), durationMax: filters.durationRange.max.toString(),
        timeStart: filters.timeRange.start, timeEnd: filters.timeRange.end,
        clientSearch: filters.clientSearch,
      })
      const res = await fetch('/api/reports/comprehensive?' + params)
      if (!res.ok) throw new Error('fetch failed')
      const data = await res.json()
      setTableData(data.employees.map((emp: any) => ({
        id: emp.id, name: emp.name, employeeId: emp.employeeId, status: 'active' as const,
        totalCalls: emp.totalCalls, totalDuration: emp.totalDuration,
        connectedCalls: emp.connectedCalls, connectedCallsDuration: emp.connectedCallsDuration,
        connectedCallsAvgDuration: emp.connectedCallsAvgDuration,
        workingHours: emp.workingHours, uniqueClients: emp.uniqueClients, uniqueConnectedCalls: emp.uniqueConnectedCalls,
        incoming: emp.incoming, outgoing: emp.outgoing, missed: emp.missed, rejected: emp.rejected,
        neverAttended: emp.neverAttended, notPickupByClient: emp.notPickupByClient,
        lastSyncTime: emp.lastSyncTime,
        todayTotalCalls: emp.todayTotalCalls, todayTotalDuration: emp.todayTotalDuration,
        todayConnectedCalls: emp.todayConnectedCalls, todayConnectedCallsDuration: emp.todayConnectedCallsDuration,
        todayConnectedCallsAvgDuration: emp.todayConnectedCallsAvgDuration,
        weekTotalCalls: emp.weekTotalCalls, weekTotalDuration: emp.weekTotalDuration,
        weekConnectedCalls: emp.weekConnectedCalls, weekConnectedCallsDuration: emp.weekConnectedCallsDuration,
        weekConnectedCallsAvgDuration: emp.weekConnectedCallsAvgDuration,
        incomingTotalCalls: emp.incomingTotalCalls, incomingTotalDuration: emp.incomingTotalDuration,
        incomingConnectedCalls: emp.incomingConnectedCalls, incomingConnectedCallsDuration: emp.incomingConnectedCallsDuration,
        incomingConnectedCallsAvgDuration: emp.incomingConnectedCallsAvgDuration,
        outgoingTotalCalls: emp.outgoingTotalCalls, outgoingTotalDuration: emp.outgoingTotalDuration,
        outgoingConnectedCalls: emp.outgoingConnectedCalls, outgoingConnectedCallsDuration: emp.outgoingConnectedCallsDuration,
        outgoingConnectedCallsAvgDuration: emp.outgoingConnectedCallsAvgDuration,
      })))
      const total = data.employees.reduce((s: number, e: any) => s + e.totalCalls, 0)
      const conn  = data.employees.reduce((s: number, e: any) => s + e.connectedCalls, 0)
      setChartData({
        distribution: [
          { name: 'Incoming', value: data.employees.reduce((s: number, e: any) => s + e.incoming, 0), color: COLORS[0] },
          { name: 'Outgoing', value: data.employees.reduce((s: number, e: any) => s + e.outgoing, 0), color: COLORS[1] },
          { name: 'Missed',   value: data.employees.reduce((s: number, e: any) => s + e.missed,   0), color: COLORS[2] },
          { name: 'Rejected', value: data.employees.reduce((s: number, e: any) => s + e.rejected, 0), color: COLORS[3] },
        ].filter(d => d.value > 0),
        daily: [{ date: 'Period', totalCalls: total, connectedCalls: conn, missedCalls: total - conn }],
        hourly: [],
      })
    } catch {
      setTableData(MOCK_ROWS)
      setChartData({
        distribution: [
          { name: 'Incoming', value: 201, color: COLORS[0] },
          { name: 'Outgoing', value: 142, color: COLORS[1] },
          { name: 'Missed',   value: 51,  color: COLORS[2] },
          { name: 'Rejected', value: 26,  color: COLORS[3] },
        ],
        daily: [{ date: 'Period', totalCalls: 343, connectedCalls: 258, missedCalls: 85 }],
        hourly: [],
      })
    } finally {
      setIsLoading(false)
    }
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchEmployees() }, [fetchEmployees])
  useEffect(() => { fetchReportsData() }, [fetchReportsData])

  const getDateRangeFromPreset = useCallback((preset: string) => {
    const today = new Date()
    let start: Date, end: Date
    switch (preset) {
      case 'yesterday': {
        const y = new Date(today); y.setDate(y.getDate() - 1)
        start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0)
        end   = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59)
        break
      }
      case 'last7days': {
        const d = new Date(today); d.setDate(d.getDate() - 7)
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
        end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
        break
      }
      case 'last30days': {
        const d = new Date(today); d.setDate(d.getDate() - 30)
        start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)
        end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
        break
      }
      case 'thismonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0)
        end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
        break
      default:
        start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
        end   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)
    }
    return { start: start.toISOString(), end: end.toISOString() }
  }, [])

  const handlePreset = (preset: string) => {
    const range = getDateRangeFromPreset(preset)
    setFilters(prev => ({ ...prev, dateRange: { ...range, preset } }))
  }
  // ── derived totals ────────────────────────────────────────────────────
  const rows = tableData.length > 0 ? tableData : []
  const T = {
    totalCalls:        rows.reduce((s,r) => s + r.totalCalls, 0),
    totalDuration:     rows.reduce((s,r) => s + r.totalDuration, 0),
    connectedCalls:    rows.reduce((s,r) => s + r.connectedCalls, 0),
    incoming:          rows.reduce((s,r) => s + r.incoming, 0),
    outgoing:          rows.reduce((s,r) => s + r.outgoing, 0),
    missed:            rows.reduce((s,r) => s + r.missed, 0),
    rejected:          rows.reduce((s,r) => s + r.rejected, 0),
    neverAttended:     rows.reduce((s,r) => s + r.neverAttended, 0),
    notPickupByClient: rows.reduce((s,r) => s + r.notPickupByClient, 0),
    uniqueClients:     rows.reduce((s,r) => s + r.uniqueClients, 0),
    uniqueConnectedCalls: rows.reduce((s,r) => s + r.uniqueConnectedCalls, 0),
    workingHours:      rows.reduce((s,r) => s + r.workingHours, 0),
    incomingDuration:  rows.reduce((s,r) => s + r.incomingTotalDuration, 0),
    outgoingDuration:  rows.reduce((s,r) => s + r.outgoingTotalDuration, 0),
  }
  const pieData = (chartData.distribution || []).filter((d: any) => d.value > 0)
  return (
    <div className="space-y-4 p-4">

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        employees={employees}
        isLoading={isLoading}
        onRefresh={fetchReportsData}
        onPreset={handlePreset}
      />
      {/* ── Tab container ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg shadow-sm border">

        {/* Tab bar */}
        <div className="border-b overflow-x-auto">
          <div className="flex min-w-max">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={"px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors " +
                  (activeTab === tab.id
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50")}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── ALL SUMMARY ─────────────────────────────────────────────── */}
        {activeTab === 'summary' && (
          <div className="p-4 space-y-4">

            {/* Top row: call-type table + stat cards + pie chart */}
            <div className="flex flex-wrap gap-4 items-start">

              {/* Call-type breakdown table */}
              <div className="flex-shrink-0">
                <table className="text-xs border border-gray-200 rounded overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-medium text-gray-600 border-b">Call Type</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">Calls</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600 border-b">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-green-600 font-medium border-b border-gray-100">&#8593; Incoming</td>
                      <td className="px-3 py-2 text-right border-b border-gray-100">{T.incoming}</td>
                      <td className="px-3 py-2 text-right border-b border-gray-100">{fmtDur(T.incomingDuration)}</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-orange-600 font-medium border-b border-gray-100">&#8595; Outgoing</td>
                      <td className="px-3 py-2 text-right border-b border-gray-100">{T.outgoing}</td>
                      <td className="px-3 py-2 text-right border-b border-gray-100">{fmtDur(T.outgoingDuration)}</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-red-600 font-medium border-b border-gray-100">&#8594; Missed</td>
                      <td className="px-3 py-2 text-right border-b border-gray-100">{T.missed}</td>
                      <td className="px-3 py-2 text-right border-b border-gray-100">&#8212;</td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-purple-600 font-medium border-b border-gray-100">&#10005; Rejected</td>
                      <td className="px-3 py-2 text-right border-b border-gray-100">{T.rejected}</td>
                      <td className="px-3 py-2 text-right border-b border-gray-100">&#8212;</td>
                    </tr>
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-2 border-t border-gray-200">Total</td>
                      <td className="px-3 py-2 text-right border-t border-gray-200">{T.totalCalls.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right border-t border-gray-200">{fmtDur(T.totalDuration)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-2 gap-2 flex-1 min-w-[220px]">
                {[
                  { label: 'Never Attended',      value: T.neverAttended,     color: 'text-gray-800' },
                  { label: 'Not Pickup by Client', value: T.notPickupByClient, color: 'text-gray-800' },
                  { label: 'Connected Calls',      value: T.connectedCalls,    color: 'text-blue-600' },
                  { label: 'Unique Conn. Calls',   value: T.uniqueConnectedCalls, color: 'text-blue-600' },
                  { label: 'Unique Clients',       value: T.uniqueClients,     color: 'text-purple-600' },
                  { label: 'Working Hours',        value: fmtDur(T.workingHours * 3600), color: 'text-gray-800' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded p-2 text-xs">
                    <div className="text-gray-500 mb-0.5">{s.label}</div>
                    <div className={"text-lg font-bold " + s.color}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* Pie chart */}
              <div className="flex-shrink-0 w-60">
                <ResponsiveContainer width="100%" height={200}>
                  <RechartsPieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80}
                      dataKey="value" label={false}>
                      {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={undefined} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Employee Summary Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Employee Summary</h3>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <input type="text" placeholder="Search employees..."
                    className="pl-7 pr-3 py-1 border rounded text-xs w-44" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[36px]">Sr.</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[120px]">Employee</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[55px]">Total Calls</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[70px]">Total Duration</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[65px]">Connected Calls</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[75px]">Conn. Duration</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[75px]">Conn. Avg. Dur.</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[60px]">Working Hours</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[55px]">Unique Clients</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-700 border border-gray-300 min-w-[65px]">Unique Conn. Calls</th>
                      <th colSpan={5} className="px-2 py-1 text-center font-medium text-green-700 border border-gray-300 bg-green-50">&#8593; Incoming</th>
                      <th colSpan={5} className="px-2 py-1 text-center font-medium text-orange-700 border border-gray-300 bg-orange-50">&#8595; Outgoing</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-red-600 border border-gray-300 min-w-[48px]">Missed</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-purple-600 border border-gray-300 min-w-[48px]">Rejected</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-600 border border-gray-300 min-w-[60px]">Never Attended</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-600 border border-gray-300 min-w-[70px]">Not Pickup by Client</th>
                      <th rowSpan={2} className="px-2 py-2 text-center font-medium text-gray-600 border border-gray-300 min-w-[80px]">Last Sync</th>
                    </tr>
                    <tr className="bg-gray-50">
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[48px] bg-green-50">Total</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[60px] bg-green-50">Duration</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[55px] bg-green-50">Conn.</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[65px] bg-green-50">Conn. Dur.</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[65px] bg-green-50">Avg. Dur.</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[48px] bg-orange-50">Total</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[60px] bg-orange-50">Duration</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[55px] bg-orange-50">Conn.</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[65px] bg-orange-50">Conn. Dur.</th>
                      <th className="px-1 py-1.5 text-center font-medium text-gray-600 border border-gray-300 min-w-[65px] bg-orange-50">Avg. Dur.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={row.id} className={i % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'}>
                        <td className="px-2 py-1.5 text-center border border-gray-300">{i + 1}</td>
                        <td className="px-2 py-1.5 border border-gray-300">
                          <div className="font-medium text-gray-900">{row.name}</div>
                          <div className="text-gray-400">{row.employeeId}</div>
                        </td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 font-medium">{row.totalCalls}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300">{fmtDur(row.totalDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 font-medium text-blue-600">{row.connectedCalls}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300">{fmtDur(row.connectedCallsDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300">{fmtDur(row.connectedCallsAvgDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300">{fmtDur(row.workingHours * 3600)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300">{row.uniqueClients}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300">{row.uniqueConnectedCalls}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-green-50 font-medium">{row.incomingTotalCalls}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-green-50">{fmtDur(row.incomingTotalDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-green-50">{row.incomingConnectedCalls}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-green-50">{fmtDur(row.incomingConnectedCallsDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-green-50">{fmtDur(row.incomingConnectedCallsAvgDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-orange-50 font-medium">{row.outgoingTotalCalls}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-orange-50">{fmtDur(row.outgoingTotalDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-orange-50">{row.outgoingConnectedCalls}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-orange-50">{fmtDur(row.outgoingConnectedCallsDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 bg-orange-50">{fmtDur(row.outgoingConnectedCallsAvgDuration)}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 font-medium text-red-600">{row.missed}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 font-medium text-purple-600">{row.rejected}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 text-gray-600">{row.neverAttended}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 text-gray-600">{row.notPickupByClient}</td>
                        <td className="px-2 py-1.5 text-center border border-gray-300 text-gray-500 text-xs">
                          {new Date(row.lastSyncTime).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {/* ── ANALYSIS TAB ────────────────────────────────────────────── */}
        {activeTab === 'analysis' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Call Distribution</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <RechartsPieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110}
                      dataKey="value" label={({name, percent}: any) => name + ' ' + (percent*100).toFixed(0) + '%'}>
                      {pieData.map((entry: any, i: number) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              {/* Bar chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Calls by Employee</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={rows.map(r => ({ name: r.name.split(' ')[0], total: r.totalCalls, connected: r.connectedCalls, missed: r.missed }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total" name="Total" fill="#3B82F6" radius={[2,2,0,0]} />
                    <Bar dataKey="connected" name="Connected" fill="#22c55e" radius={[2,2,0,0]} />
                    <Bar dataKey="missed" name="Missed" fill="#ef4444" radius={[2,2,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Calls',      value: T.totalCalls,     color: 'text-blue-600' },
                { label: 'Connected Calls',  value: T.connectedCalls, color: 'text-green-600' },
                { label: 'Connection Rate',  value: T.totalCalls > 0 ? ((T.connectedCalls / T.totalCalls) * 100).toFixed(1) + '%' : '0%', color: 'text-purple-600' },
                { label: 'Avg Duration',     value: fmtDur(T.connectedCalls > 0 ? Math.round(T.totalDuration / T.connectedCalls) : 0), color: 'text-orange-600' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className={"text-2xl font-bold " + s.color}>{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DAY-WISE ANALYSIS ───────────────────────────────────────── */}
        {activeTab === 'daywise' && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Day-wise Call Analysis</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={chartData.daily || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Area dataKey="totalCalls" name="Total Calls" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                <Line dataKey="connectedCalls" name="Connected" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Bar dataKey="missedCalls" name="Missed" fill="#ef4444" radius={[2,2,0,0]} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left border border-gray-200">Date</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Total Calls</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Connected</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Missed</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Connection Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {(chartData.daily || []).map((d: any, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 border border-gray-200 font-medium">{d.date}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">{d.totalCalls}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-green-600">{d.connectedCalls}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-red-600">{d.missedCalls}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">
                        {d.totalCalls > 0 ? ((d.connectedCalls / d.totalCalls) * 100).toFixed(1) + '%' : '0%'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── HOURLY ANALYSIS ─────────────────────────────────────────── */}
        {activeTab === 'hourly' && (
          <HourlyAnalysisTab
            orgId={_orgId}
            startDate={filters.dateRange.start}
            endDate={filters.dateRange.end}
          />
        )}
        {/* ── NEVER ATTENDED ──────────────────────────────────────────── */}
        {activeTab === 'never_attended' && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Never Attended Calls</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left border border-gray-200">Sr.</th>
                    <th className="px-3 py-2 text-left border border-gray-200">Employee</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Never Attended</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Total Calls</th>
                    <th className="px-3 py-2 text-right border border-gray-200">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter(r => r.neverAttended > 0).map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 border border-gray-200">{i + 1}</td>
                      <td className="px-3 py-2 border border-gray-200">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-gray-400">{row.employeeId}</div>
                      </td>
                      <td className="px-3 py-2 text-right border border-gray-200 font-medium text-red-600">{row.neverAttended}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">{row.totalCalls}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">
                        {row.totalCalls > 0 ? ((row.neverAttended / row.totalCalls) * 100).toFixed(1) + '%' : '0%'}
                      </td>
                    </tr>
                  ))}
                  {rows.filter(r => r.neverAttended > 0).length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No never-attended calls in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── NO PICKUP BY CLIENT ─────────────────────────────────────── */}
        {activeTab === 'no_pickup' && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Not Picked Up by Client</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left border border-gray-200">Sr.</th>
                    <th className="px-3 py-2 text-left border border-gray-200">Employee</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Not Pickup by Client</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Outgoing Calls</th>
                    <th className="px-3 py-2 text-right border border-gray-200">% of Outgoing</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter(r => r.notPickupByClient > 0).map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 border border-gray-200">{i + 1}</td>
                      <td className="px-3 py-2 border border-gray-200">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-gray-400">{row.employeeId}</div>
                      </td>
                      <td className="px-3 py-2 text-right border border-gray-200 font-medium text-orange-600">{row.notPickupByClient}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">{row.outgoing}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">
                        {row.outgoing > 0 ? ((row.notPickupByClient / row.outgoing) * 100).toFixed(1) + '%' : '0%'}
                      </td>
                    </tr>
                  ))}
                  {rows.filter(r => r.notPickupByClient > 0).length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">No data for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── UNIQUE CLIENTS ──────────────────────────────────────────── */}
        {activeTab === 'unique_clients' && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Unique Clients per Employee</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left border border-gray-200">Sr.</th>
                    <th className="px-3 py-2 text-left border border-gray-200">Employee</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Unique Clients</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Unique Conn. Calls</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Total Calls</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Calls / Client</th>
                  </tr>
                </thead>
                <tbody>
                  {[...rows].sort((a,b) => b.uniqueClients - a.uniqueClients).map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 border border-gray-200">{i + 1}</td>
                      <td className="px-3 py-2 border border-gray-200">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-gray-400">{row.employeeId}</div>
                      </td>
                      <td className="px-3 py-2 text-right border border-gray-200 font-medium text-purple-600">{row.uniqueClients}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-blue-600">{row.uniqueConnectedCalls}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">{row.totalCalls}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">
                        {row.uniqueClients > 0 ? (row.totalCalls / row.uniqueClients).toFixed(1) : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── CALL HISTORY ────────────────────────────────────────────── */}
        {activeTab === 'call_history' && (
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Call History Summary</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left border border-gray-200">Sr.</th>
                    <th className="px-3 py-2 text-left border border-gray-200">Employee</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Total Calls</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Connected</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Incoming</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Outgoing</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Missed</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Rejected</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Total Duration</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Avg Duration</th>
                    <th className="px-3 py-2 text-right border border-gray-200">Last Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 border border-gray-200">{i + 1}</td>
                      <td className="px-3 py-2 border border-gray-200">
                        <div className="font-medium">{row.name}</div>
                        <div className="text-gray-400">{row.employeeId}</div>
                      </td>
                      <td className="px-3 py-2 text-right border border-gray-200 font-medium">{row.totalCalls}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-blue-600">{row.connectedCalls}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-green-600">{row.incoming}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-orange-600">{row.outgoing}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-red-600">{row.missed}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-purple-600">{row.rejected}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">{fmtDur(row.totalDuration)}</td>
                      <td className="px-3 py-2 text-right border border-gray-200">{fmtDur(row.connectedCallsAvgDuration)}</td>
                      <td className="px-3 py-2 text-right border border-gray-200 text-gray-500">
                        {new Date(row.lastSyncTime).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
