import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

export interface EnhancedReportFilters {
  start: string
  end: string
  employees?: string[]
  callTypes?: string[]
  durationRange?: { min: number; max: number }
  timeRange?: { start: string; end: string }
  clientSearch?: string
  showOnlyConnected?: boolean
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId(user.id)
    const { searchParams } = new URL(request.url)
    
    // Parse filters from query parameters
    const filters: EnhancedReportFilters = {
      start: searchParams.get('start') || '',
      end: searchParams.get('end') || '',
      employees: searchParams.get('employees')?.split(',').filter(Boolean) || [],
      callTypes: searchParams.get('callTypes')?.split(',').filter(Boolean) || [],
      durationRange: searchParams.get('durationMin') && searchParams.get('durationMax') ? {
        min: parseInt(searchParams.get('durationMin') || '0', 10),
        max: parseInt(searchParams.get('durationMax') || '86400', 10)
      } : undefined,
      timeRange: searchParams.get('timeStart') && searchParams.get('timeEnd') ? {
        start: searchParams.get('timeStart') || '00:00',
        end: searchParams.get('timeEnd') || '23:59'
      } : undefined,
      clientSearch: searchParams.get('clientSearch') || undefined,
      showOnlyConnected: searchParams.get('showOnlyConnected') === 'true',
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10),
      sortBy: searchParams.get('sortBy') || 'called_at',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
    }

    if (!filters.start || !filters.end) {
      return NextResponse.json(
        { error: 'Missing required parameters: start, end' },
        { status: 400 }
      )
    }

    // Build optimized query with filters
    const reportData = await getEnhancedReportData(supabase, orgId, filters)
    
    return NextResponse.json(reportData)
  } catch (error) {
    console.error('Error fetching enhanced report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch enhanced report' },
      { status: 500 }
    )
  }
}

async function getEnhancedReportData(supabase: any, orgId: string, filters: EnhancedReportFilters) {
  // Build base query with proper indexing
  let query = supabase
    .from('call_logs')
    .select(`
      id,
      device_call_id,
      contact_number,
      contact_name,
      call_type,
      duration_sec,
      called_at,
      sim_id,
      caller_id,
      callers!inner(
        id,
        name,
        employee_id
      )
    `)
    .eq('org_id', orgId)
    .gte('called_at', filters.start)
    .lte('called_at', filters.end)

  // Apply employee filter
  if (filters.employees && filters.employees.length > 0) {
    query = query.in('caller_id', filters.employees)
  }

  // Apply call type filter
  if (filters.callTypes && filters.callTypes.length > 0) {
    query = query.in('call_type', filters.callTypes)
  }

  // Apply duration filter
  if (filters.durationRange) {
    query = query
      .gte('duration_sec', filters.durationRange.min)
      .lte('duration_sec', filters.durationRange.max)
  }

  // Apply connected calls filter
  if (filters.showOnlyConnected) {
    query = query.gt('duration_sec', 0)
  }

  // Apply client search filter
  if (filters.clientSearch) {
    query = query.or(`contact_number.ilike.%${filters.clientSearch}%,contact_name.ilike.%${filters.clientSearch}%`)
  }

  // Apply time range filter (extract time from timestamp)
  if (filters.timeRange) {
    // Use PostgreSQL time extraction for efficient filtering
    query = query
      .gte('called_at::time', filters.timeRange.start)
      .lte('called_at::time', filters.timeRange.end)
  }

  // Apply sorting
  const sortColumn = filters.sortBy === 'employee_name' ? 'callers.name' : filters.sortBy
  query = query.order(sortColumn, { ascending: filters.sortOrder === 'asc' })

  // Apply pagination
  const offset = ((filters.page || 1) - 1) * (filters.limit || 50)
  query = query.range(offset, offset + (filters.limit || 50) - 1)

  const { data: callLogs, error, count } = await query

  if (error) throw new Error(error.message)

  // Get aggregated statistics in parallel
  const [summaryStats, employeeStats, hourlyDistribution, callTypeDistribution] = await Promise.all([
    getSummaryStatistics(supabase, orgId, filters),
    getEmployeeStatistics(supabase, orgId, filters),
    getHourlyDistribution(supabase, orgId, filters),
    getCallTypeDistribution(supabase, orgId, filters)
  ])

  return {
    callLogs: callLogs || [],
    totalCount: count || 0,
    currentPage: filters.page || 1,
    totalPages: Math.ceil((count || 0) / (filters.limit || 50)),
    summary: summaryStats,
    employees: employeeStats,
    hourlyDistribution,
    callTypeDistribution,
    filters
  }
}

async function getSummaryStatistics(supabase: any, orgId: string, filters: EnhancedReportFilters) {
  let query = supabase
    .from('call_logs')
    .select('call_type, duration_sec, contact_number')
    .eq('org_id', orgId)
    .gte('called_at', filters.start)
    .lte('called_at', filters.end)

  // Apply same filters as main query
  if (filters.employees && filters.employees.length > 0) {
    query = query.in('caller_id', filters.employees)
  }
  if (filters.callTypes && filters.callTypes.length > 0) {
    query = query.in('call_type', filters.callTypes)
  }
  if (filters.durationRange) {
    query = query.gte('duration_sec', filters.durationRange.min).lte('duration_sec', filters.durationRange.max)
  }
  if (filters.showOnlyConnected) {
    query = query.gt('duration_sec', 0)
  }
  if (filters.clientSearch) {
    query = query.or(`contact_number.ilike.%${filters.clientSearch}%,contact_name.ilike.%${filters.clientSearch}%`)
  }
  if (filters.timeRange) {
    query = query.gte('called_at::time', filters.timeRange.start).lte('called_at::time', filters.timeRange.end)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  // Calculate statistics
  const totalCalls = data?.length || 0
  const connectedCalls = data?.filter((call: any) => call.duration_sec > 0).length || 0
  const totalDuration = data?.reduce((sum: number, call: any) => sum + call.duration_sec, 0) || 0
  const uniqueClients = new Set(data?.map((call: any) => call.contact_number)).size || 0
  const avgDuration = connectedCalls > 0 ? totalDuration / connectedCalls : 0

  const callTypeCounts = data?.reduce((acc: any, call: any) => {
    acc[call.call_type] = (acc[call.call_type] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return {
    totalCalls,
    connectedCalls,
    connectionRate: totalCalls > 0 ? (connectedCalls / totalCalls) * 100 : 0,
    totalDuration,
    avgDuration,
    uniqueClients,
    callTypes: callTypeCounts
  }
}

async function getEmployeeStatistics(supabase: any, orgId: string, filters: EnhancedReportFilters) {
  // Use the existing get_employee_report RPC for consistency
  const { data, error } = await supabase.rpc('get_employee_report', {
    p_org_id: orgId,
    p_start: filters.start,
    p_end: filters.end,
  })

  if (error) throw new Error(error.message)

  let employeeData = data || []

  // Apply employee filter if specified
  if (filters.employees && filters.employees.length > 0) {
    employeeData = employeeData.filter((emp: any) => 
      filters.employees!.includes(emp.caller_id)
    )
  }

  return employeeData.map((row: any) => ({
    callerId: row.caller_id,
    name: row.name,
    employeeId: row.employee_id,
    totalCalls: row.total_calls,
    connectedCalls: row.connected_calls,
    connectionRate: row.total_calls > 0 ? (row.connected_calls / row.total_calls) * 100 : 0,
    totalDuration: row.total_duration_sec,
    avgDuration: row.avg_duration_sec,
    uniqueClients: row.unique_clients,
    workingHours: row.working_hours_sec
  }))
}

async function getHourlyDistribution(supabase: any, orgId: string, filters: EnhancedReportFilters) {
  const { data, error } = await supabase.rpc('get_hourly_metrics', {
    p_org_id: orgId,
    p_start: filters.start,
    p_end: filters.end,
  })

  if (error) throw new Error(error.message)
  return data || []
}

async function getCallTypeDistribution(supabase: any, orgId: string, filters: EnhancedReportFilters) {
  const { data, error } = await supabase.rpc('get_call_type_distribution', {
    p_org_id: orgId,
    p_start: filters.start,
    p_end: filters.end,
  })

  if (error) throw new Error(error.message)
  return data || {}
}