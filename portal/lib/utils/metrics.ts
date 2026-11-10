import type { CallLog, DashboardMetrics, EmployeeReportRow } from '@/types/domain'

/**
 * Computes all dashboard metrics from an array of call logs.
 * Pure function — no side effects, no I/O.
 */
export function computeEmployeeMetrics(logs: CallLog[]): Omit<EmployeeReportRow, 'callerId' | 'name' | 'employeeId'> {
  const totalCalls = logs.length
  const incoming = logs.filter((l) => l.callType === 'incoming').length
  const outgoing = logs.filter((l) => l.callType === 'outgoing').length
  const missed = logs.filter((l) => l.callType === 'missed').length
  const rejected = logs.filter((l) => l.callType === 'rejected').length
  const neverAttended = logs.filter((l) => l.callType === 'never_attended').length
  const notPickupByClient = logs.filter((l) => l.callType === 'not_pickup_by_client').length
  const connectedCalls = logs.filter((l) => l.durationSec > 0).length
  const totalDurationSec = logs.reduce((sum, l) => sum + l.durationSec, 0)
  const avgDurationSec = totalCalls > 0 ? totalDurationSec / totalCalls : 0
  const uniqueClients = new Set(logs.map((l) => l.contactNumber)).size
  const workingHoursSec = computeWorkingHours(logs)

  return {
    totalCalls,
    incoming,
    outgoing,
    missed,
    rejected,
    neverAttended,
    notPickupByClient,
    connectedCalls,
    totalDurationSec,
    avgDurationSec,
    uniqueClients,
    workingHoursSec,
  }
}

/**
 * Computes working hours as the sum of (last_call - first_call) per calendar day.
 * Pure function — no side effects.
 */
export function computeWorkingHours(logs: CallLog[]): number {
  if (logs.length === 0) return 0

  // Group logs by calendar day (YYYY-MM-DD)
  const byDay = new Map<string, Date[]>()
  for (const log of logs) {
    const date = new Date(log.calledAt)
    const dayKey = date.toISOString().slice(0, 10)
    if (!byDay.has(dayKey)) byDay.set(dayKey, [])
    byDay.get(dayKey)!.push(date)
  }

  let totalSeconds = 0
  for (const timestamps of Array.from(byDay.values())) {
    const min = Math.min(...timestamps.map((d: Date) => d.getTime()))
    const max = Math.max(...timestamps.map((d: Date) => d.getTime()))
    totalSeconds += (max - min) / 1000
  }

  return totalSeconds
}

/**
 * Computes delta percentages between current and prior period metrics.
 * Returns null for a metric if prior value is 0.
 */
export function computeMetricsWithDelta(
  current: Record<string, number>,
  prior: Record<string, number>
): DashboardMetrics {
  const toMetrics = (raw: Record<string, any>): Omit<DashboardMetrics, 'delta'> => {
    const callTypes = raw.callTypes as Record<string, number> | undefined
    return {
      totalCalls: Number(raw.totalCalls ?? raw.total_calls ?? 0),
      totalDurationSec: Number(raw.totalDuration ?? raw.total_duration_sec ?? 0),
      incomingCalls: Number(callTypes?.incoming ?? raw.incomingCalls ?? raw.incoming_calls ?? 0),
      outgoingCalls: Number(callTypes?.outgoing ?? raw.outgoingCalls ?? raw.outgoing_calls ?? 0),
      missedCalls: Number(callTypes?.missed ?? raw.missedCalls ?? raw.missed_calls ?? 0),
      rejectedCalls: Number(callTypes?.rejected ?? raw.rejectedCalls ?? raw.rejected_calls ?? 0),
      neverAttendedCalls: Number(raw.neverAttendedCalls ?? raw.never_attended_calls ?? 0),
      notPickupByClientCalls: Number(raw.notPickupByClientCalls ?? raw.not_pickup_by_client ?? 0),
      uniqueClients: Number(raw.uniqueClients ?? raw.unique_clients ?? 0),
      workingHoursSec: Number(raw.workingHoursSec ?? raw.working_hours_sec ?? 0),
      connectedCalls: Number(raw.connectedCalls ?? raw.connected_calls ?? 0),
    }
  }

  const curr = toMetrics(current)
  const prev = toMetrics(prior)

  const delta: Partial<Omit<DashboardMetrics, 'delta'>> = {}
  const keys = Object.keys(curr) as Array<keyof Omit<DashboardMetrics, 'delta'>>
  for (const key of keys) {
    const c = curr[key]
    const p = prev[key]
    if (p === 0) {
      delta[key] = undefined
    } else {
      delta[key] = Math.round(((c - p) / p) * 1000) / 10 // one decimal place
    }
  }

  return { ...curr, delta }
}
