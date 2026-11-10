import { createClient } from '@/lib/supabase/server'
import type { CallTypeDistribution, EmployeeReportRow } from '@/types/domain'

export async function getEmployeeReport(
  orgId: string,
  start: string,
  end: string
): Promise<EmployeeReportRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_employee_report', {
    p_org_id: orgId,
    p_start: start,
    p_end: end,
  })

  if (error) throw new Error(error.message)
  if (!data) return []

  return data.map((row) => ({
    callerId: row.caller_id,
    name: row.name,
    employeeId: row.employee_id,
    totalCalls: row.total_calls,
    incoming: row.incoming,
    outgoing: row.outgoing,
    missed: row.missed,
    rejected: row.rejected,
    neverAttended: row.never_attended,
    notPickupByClient: row.not_pickup_by_client,
    connectedCalls: row.connected_calls,
    totalDurationSec: row.total_duration_sec,
    avgDurationSec: row.avg_duration_sec,
    uniqueClients: row.unique_clients,
    workingHoursSec: row.working_hours_sec,
  }))
}

export async function getCallTypeDistribution(
  orgId: string,
  start: string,
  end: string
): Promise<CallTypeDistribution> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_call_type_distribution', {
    p_org_id: orgId,
    p_start: start,
    p_end: end,
  })

  if (error) throw new Error(error.message)

  const raw = (data ?? {}) as Record<string, number>
  return {
    incoming: raw.incoming ?? 0,
    outgoing: raw.outgoing ?? 0,
    missed: raw.missed ?? 0,
    rejected: raw.rejected ?? 0,
    neverAttended: raw.never_attended ?? 0,
    notPickupByClient: raw.not_pickup_by_client ?? 0,
  }
}

export interface DailyMetrics {
  date: string
  totalCalls: number
  incomingCalls: number
  outgoingCalls: number
  missedCalls: number
  connectedCalls: number
  totalDuration: number
}

export async function getDailyMetrics(
  orgId: string,
  start: string,
  end: string
): Promise<DailyMetrics[]> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase.rpc('get_daily_metrics', {
      p_org_id: orgId,
      p_start: start,
      p_end: end,
    })

    if (error) throw new Error(error.message)
    if (!data) return []

    return data.map((row: any) => ({
      date: row.call_date,
      totalCalls: row.total_calls,
      incomingCalls: row.incoming_calls,
      outgoingCalls: row.outgoing_calls,
      missedCalls: row.missed_calls,
      connectedCalls: row.connected_calls,
      totalDuration: row.total_duration,
    }))
  } catch (error) {
    console.error('Error in getDailyMetrics:', error)
    // Return empty array as fallback
    return []
  }
}

export interface HourlyMetrics {
  hour: string
  calls: number
  avgDuration: number
}

export async function getHourlyMetrics(
  orgId: string,
  start: string,
  end: string
): Promise<HourlyMetrics[]> {
  const supabase = createClient()
  
  try {
    const { data, error } = await supabase.rpc('get_hourly_metrics', {
      p_org_id: orgId,
      p_start: start,
      p_end: end,
    })

    if (error) throw new Error(error.message)
    if (!data) return []

    return data.map((row: any) => ({
      hour: row.hour,
      calls: row.calls,
      avgDuration: row.avg_duration || 0,
    }))
  } catch (error) {
    console.error('Error in getHourlyMetrics:', error)
    // Return empty array as fallback
    return []
  }
}

export interface CallAnalytics {
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

export async function getCallAnalytics(
  orgId: string,
  start: string,
  end: string
): Promise<CallAnalytics> {
  const supabase = createClient()
  
  try {
    // Get call logs with employee info
    const { data: callLogs, error: callError } = await supabase
      .from('call_logs')
      .select(`
        id,
        caller_id,
        call_type,
        duration_sec,
        contact_number,
        called_at,
        created_at,
        callers!inner(name, employee_id)
      `)
      .eq('org_id', orgId)
      .gte('called_at', start)
      .lte('called_at', end)

    if (callError) throw new Error(callError.message)
    if (!callLogs) throw new Error('No call data found')

  // Calculate analytics
  const analytics: CallAnalytics = {
    totalDuration: {
      highest: { caller: '', duration: 0, callId: '' },
      longest: { caller: '', duration: 0, callId: '' },
      average: 0,
    },
    topPerformers: {
      dialer: { name: '', employeeId: '', totalCalls: 0 },
      answered: { name: '', employeeId: '', answeredCalls: 0 },
      caller: { name: '', employeeId: '', uniqueClients: 0 },
    },
    callPatterns: {
      avgDurationIncoming: 0,
      avgDurationOutgoing: 0,
      avgDurationMissed: 0,
      peakHour: '',
      peakDay: '',
    },
  }

  if (callLogs.length === 0) return analytics

  // Employee metrics
  const employeeMetrics = new Map<string, {
    name: string
    employeeId: string
    totalCalls: number
    answeredCalls: number
    uniqueClients: Set<string>
    totalDuration: number
  }>()

  // Call type durations
  const callTypeDurations = {
    incoming: [] as number[],
    outgoing: [] as number[],
    missed: [] as number[],
  }

  // Hourly and daily counts
  const hourlyCounts = new Map<string, number>()
  const dailyCounts = new Map<string, number>()

  let totalDuration = 0
  let connectedCalls = 0
  let longestCall = { caller: '', duration: 0, callId: '' }

  callLogs.forEach((call) => {
    const employeeKey = call.caller_id
    const employee = call.callers as any
    
    if (!employeeMetrics.has(employeeKey)) {
      employeeMetrics.set(employeeKey, {
        name: employee?.name || 'Unknown',
        employeeId: employee?.employee_id || call.caller_id,
        totalCalls: 0,
        answeredCalls: 0,
        uniqueClients: new Set(),
        totalDuration: 0,
      })
    }

    const metrics = employeeMetrics.get(employeeKey)!
    metrics.totalCalls++
    metrics.uniqueClients.add(call.contact_number)

    if (call.duration_sec && call.duration_sec > 0) {
      metrics.answeredCalls++
      metrics.totalDuration += call.duration_sec
      totalDuration += call.duration_sec
      connectedCalls++

      // Track longest call
      if (call.duration_sec > longestCall.duration) {
        longestCall = {
          caller: metrics.name,
          duration: call.duration_sec,
          callId: call.id,
        }
      }

      // Track call type durations
      if (call.call_type === 'incoming') {
        callTypeDurations.incoming.push(call.duration_sec)
      } else if (call.call_type === 'outgoing') {
        callTypeDurations.outgoing.push(call.duration_sec)
      }
    } else {
      callTypeDurations.missed.push(0)
    }

    // Track hourly patterns
    if (call.created_at) {
      const hour = new Date(call.created_at).getHours().toString().padStart(2, '0') + ':00'
      hourlyCounts.set(hour, (hourlyCounts.get(hour) || 0) + 1)
    }

    // Track daily patterns
    const day = new Date(call.called_at).toISOString().slice(0, 10)
    dailyCounts.set(day, (dailyCounts.get(day) || 0) + 1)
  })

  // Find top performers
  const employees = Array.from(employeeMetrics.values())
  
  analytics.topPerformers.dialer = employees.reduce((max, curr) => 
    curr.totalCalls > max.totalCalls ? curr : max, employees[0] || { name: '', employeeId: '', totalCalls: 0 }
  )
  
  analytics.topPerformers.answered = employees.reduce((max, curr) => 
    curr.answeredCalls > max.answeredCalls ? curr : max, employees[0] || { name: '', employeeId: '', answeredCalls: 0 }
  )
  
  // Convert uniqueClients Set to number for comparison
  const employeesWithUniqueCount = employees.map(emp => ({
    ...emp,
    uniqueClientsCount: emp.uniqueClients.size
  }))
  
  const topCaller = employeesWithUniqueCount.reduce((max, curr) => 
    curr.uniqueClientsCount > max.uniqueClientsCount ? curr : max, 
    employeesWithUniqueCount[0] || { name: '', employeeId: '', uniqueClientsCount: 0 }
  )
  
  analytics.topPerformers.caller = {
    name: topCaller.name,
    employeeId: topCaller.employeeId,
    uniqueClients: topCaller.uniqueClientsCount
  }

  // Find employee with highest total duration
  const highestDurationEmployee = employees.reduce((max, curr) => 
    curr.totalDuration > max.totalDuration ? curr : max, employees[0] || { name: '', employeeId: '', totalDuration: 0 }
  )

  analytics.totalDuration = {
    highest: {
      caller: highestDurationEmployee.name,
      duration: highestDurationEmployee.totalDuration,
      callId: '',
    },
    longest: longestCall,
    average: connectedCalls > 0 ? totalDuration / connectedCalls : 0,
  }

  // Calculate average durations by call type
  analytics.callPatterns = {
    avgDurationIncoming: callTypeDurations.incoming.length > 0 
      ? callTypeDurations.incoming.reduce((a, b) => a + b, 0) / callTypeDurations.incoming.length 
      : 0,
    avgDurationOutgoing: callTypeDurations.outgoing.length > 0 
      ? callTypeDurations.outgoing.reduce((a, b) => a + b, 0) / callTypeDurations.outgoing.length 
      : 0,
    avgDurationMissed: totalDuration > 0 && callLogs.length > 0 
      ? totalDuration / callLogs.length 
      : 0,
    peakHour: Array.from(hourlyCounts.entries()).reduce((max, curr) => 
      curr[1] > max[1] ? curr : max, ['00:00', 0]
    )[0],
    peakDay: Array.from(dailyCounts.entries()).reduce((max, curr) => 
      curr[1] > max[1] ? curr : max, ['', 0]
    )[0],
  }

  return analytics
  } catch (error) {
    console.error('Error in getCallAnalytics:', error)
    // Return default analytics object as fallback
    return {
      totalDuration: {
        highest: { caller: '', duration: 0, callId: '' },
        longest: { caller: '', duration: 0, callId: '' },
        average: 0,
      },
      topPerformers: {
        dialer: { name: '', employeeId: '', totalCalls: 0 },
        answered: { name: '', employeeId: '', answeredCalls: 0 },
        caller: { name: '', employeeId: '', uniqueClients: 0 },
      },
      callPatterns: {
        avgDurationIncoming: 0,
        avgDurationOutgoing: 0,
        avgDurationMissed: 0,
        peakHour: '',
        peakDay: '',
      },
    }
  }
}
