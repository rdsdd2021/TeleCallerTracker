import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

export interface ComprehensiveReportFilters {
  start: string
  end: string
  employees?: string[]
  callTypes?: string[]
  durationRange?: { min: number; max: number }
  timeRange?: { start: string; end: string }
  clientSearch?: string
  showOnlyConnected?: boolean
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
    const filters: ComprehensiveReportFilters = {
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
    }

    if (!filters.start || !filters.end) {
      return NextResponse.json(
        { error: 'Missing required parameters: start, end' },
        { status: 400 }
      )
    }

    // Get comprehensive report data
    const reportData = await getComprehensiveReportData(supabase, orgId, filters)
    
    return NextResponse.json(reportData)
  } catch (error) {
    console.error('Error fetching comprehensive report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch comprehensive report' },
      { status: 500 }
    )
  }
}

async function getComprehensiveReportData(supabase: any, orgId: string, filters: ComprehensiveReportFilters) {
  // Use the existing get_employee_report RPC function which has all the data we need
  const { data: employeeReportData, error } = await supabase.rpc('get_employee_report', {
    p_org_id: orgId,
    p_start: filters.start,
    p_end: filters.end,
  })

  if (error) throw new Error(error.message)

  let employees = employeeReportData || []

  // Apply employee filter if specified
  if (filters.employees && filters.employees.length > 0) {
    employees = employees.filter((emp: any) => 
      filters.employees!.includes(emp.caller_id)
    )
  }

  // Get comprehensive data for each employee
  const employeeReports = await Promise.all(
    employees.map(async (employee: any) => {
      return await getEmployeeComprehensiveData(supabase, orgId, employee, filters)
    })
  )

  return {
    employees: employeeReports.filter(emp => emp !== null),
    filters,
    generatedAt: new Date().toISOString()
  }
}

async function getEmployeeComprehensiveData(supabase: any, orgId: string, employee: any, filters: ComprehensiveReportFilters) {
  // Get today's data
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString()
  
  // Get this week's data
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay()) // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(today)
  weekEnd.setDate(today.getDate() + (6 - today.getDay())) // End of week (Saturday)
  weekEnd.setHours(23, 59, 59, 999)

  // Get today's data using the same RPC function
  const { data: todayData } = await supabase.rpc('get_employee_report', {
    p_org_id: orgId,
    p_start: todayStart,
    p_end: todayEnd,
  })

  // Get week's data using the same RPC function
  const { data: weekData } = await supabase.rpc('get_employee_report', {
    p_org_id: orgId,
    p_start: weekStart.toISOString(),
    p_end: weekEnd.toISOString(),
  })

  // Find this employee's data in today and week results
  const todayEmployee = todayData?.find((emp: any) => emp.caller_id === employee.caller_id) || {
    total_calls: 0,
    total_duration_sec: 0,
    connected_calls: 0,
    avg_duration_sec: 0,
    incoming: 0,
    outgoing: 0,
    missed: 0,
    rejected: 0,
    never_attended: 0,
    not_pickup_by_client: 0
  }

  const weekEmployee = weekData?.find((emp: any) => emp.caller_id === employee.caller_id) || {
    total_calls: 0,
    total_duration_sec: 0,
    connected_calls: 0,
    avg_duration_sec: 0,
    incoming: 0,
    outgoing: 0,
    missed: 0,
    rejected: 0,
    never_attended: 0,
    not_pickup_by_client: 0
  }

  // Get detailed incoming call data
  const incomingCallsData = await getCallTypeBreakdown(supabase, orgId, employee.caller_id, filters.start, filters.end, 'incoming')
  const outgoingCallsData = await getCallTypeBreakdown(supabase, orgId, employee.caller_id, filters.start, filters.end, 'outgoing')

  // Calculate connected call duration (total duration of connected calls)
  const connectedCallsDuration = employee.connected_calls > 0 ? employee.total_duration_sec : 0
  const todayConnectedCallsDuration = todayEmployee.connected_calls > 0 ? todayEmployee.total_duration_sec : 0
  const weekConnectedCallsDuration = weekEmployee.connected_calls > 0 ? weekEmployee.total_duration_sec : 0

  // Get last sync time (most recent call)
  const { data: lastCall } = await supabase
    .from('call_logs')
    .select('called_at')
    .eq('org_id', orgId)
    .eq('caller_id', employee.caller_id)
    .order('called_at', { ascending: false })
    .limit(1)

  // Get unique connected calls count
  const { data: uniqueConnectedCallsData } = await supabase
    .from('call_logs')
    .select('contact_number')
    .eq('org_id', orgId)
    .eq('caller_id', employee.caller_id)
    .gte('called_at', filters.start)
    .lte('called_at', filters.end)
    .gt('duration_sec', 0)

  const uniqueConnectedCalls = uniqueConnectedCallsData ? 
    new Set(uniqueConnectedCallsData.map((call: any) => call.contact_number)).size : 0

  return {
    id: employee.caller_id,
    name: employee.name,
    employeeId: employee.employee_id,
    workingHours: Math.round(employee.working_hours_sec / 3600), // Convert seconds to hours
    uniqueClients: employee.unique_clients,
    uniqueConnectedCalls,
    
    // Overall period data (from the main RPC call)
    totalCalls: employee.total_calls,
    totalDuration: employee.total_duration_sec,
    connectedCalls: employee.connected_calls,
    connectedCallsDuration,
    connectedCallsAvgDuration: employee.avg_duration_sec,
    
    // Today's data
    todayTotalCalls: todayEmployee.total_calls,
    todayTotalDuration: todayEmployee.total_duration_sec,
    todayConnectedCalls: todayEmployee.connected_calls,
    todayConnectedCallsDuration,
    todayConnectedCallsAvgDuration: todayEmployee.avg_duration_sec,
    
    // Week's data
    weekTotalCalls: weekEmployee.total_calls,
    weekTotalDuration: weekEmployee.total_duration_sec,
    weekConnectedCalls: weekEmployee.connected_calls,
    weekConnectedCallsDuration,
    weekConnectedCallsAvgDuration: weekEmployee.avg_duration_sec,
    
    // Call type breakdown (from the main RPC call)
    incoming: employee.incoming,
    outgoing: employee.outgoing,
    missed: employee.missed,
    rejected: employee.rejected,
    neverAttended: employee.never_attended,
    notPickupByClient: employee.not_pickup_by_client,
    
    // Detailed incoming call data
    incomingTotalCalls: incomingCallsData.totalCalls,
    incomingTotalDuration: incomingCallsData.totalDuration,
    incomingConnectedCalls: incomingCallsData.connectedCalls,
    incomingConnectedCallsDuration: incomingCallsData.connectedCallsDuration,
    incomingConnectedCallsAvgDuration: incomingCallsData.connectedCallsAvgDuration,
    
    // Detailed outgoing call data
    outgoingTotalCalls: outgoingCallsData.totalCalls,
    outgoingTotalDuration: outgoingCallsData.totalDuration,
    outgoingConnectedCalls: outgoingCallsData.connectedCalls,
    outgoingConnectedCallsDuration: outgoingCallsData.connectedCallsDuration,
    outgoingConnectedCallsAvgDuration: outgoingCallsData.connectedCallsAvgDuration,
    
    // System info
    lastSyncTime: lastCall?.[0]?.called_at || new Date().toISOString()
  }
}

async function getCallTypeBreakdown(supabase: any, orgId: string, employeeId: string, start: string, end: string, callType: string) {
  const { data, error } = await supabase
    .from('call_logs')
    .select('duration_sec')
    .eq('org_id', orgId)
    .eq('caller_id', employeeId)
    .eq('call_type', callType)
    .gte('called_at', start)
    .lte('called_at', end)

  if (error) throw new Error(error.message)

  const calls = data || []
  const totalCalls = calls.length
  const connectedCalls = calls.filter((call: any) => call.duration_sec > 0)
  const totalDuration = calls.reduce((sum: number, call: any) => sum + call.duration_sec, 0)
  const connectedCallsDuration = connectedCalls.reduce((sum: number, call: any) => sum + call.duration_sec, 0)
  const connectedCallsAvgDuration = connectedCalls.length > 0 ? connectedCallsDuration / connectedCalls.length : 0

  return {
    totalCalls,
    totalDuration,
    connectedCalls: connectedCalls.length,
    connectedCallsDuration,
    connectedCallsAvgDuration
  }
}

