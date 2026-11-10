export type Period = 'today' | 'yesterday' | 'last_week'

export interface DashboardMetrics {
  totalCalls: number
  totalDurationSec: number
  incomingCalls: number
  outgoingCalls: number
  missedCalls: number
  rejectedCalls: number
  neverAttendedCalls: number
  notPickupByClientCalls: number
  uniqueClients: number
  workingHoursSec: number
  connectedCalls: number
  delta?: Partial<Omit<DashboardMetrics, 'delta'>>
}

export interface EmployeeReportRow {
  callerId: string
  name: string
  employeeId: string
  totalCalls: number
  incoming: number
  outgoing: number
  missed: number
  rejected: number
  neverAttended: number
  notPickupByClient: number
  connectedCalls: number
  totalDurationSec: number
  avgDurationSec: number
  uniqueClients: number
  workingHoursSec: number
}

export interface CallTypeDistribution {
  incoming: number
  outgoing: number
  missed: number
  rejected: number
  neverAttended: number
  notPickupByClient: number
}

export interface CallLog {
  id: string
  callerId: string
  orgId: string
  contactNumber: string
  callType: 'incoming' | 'outgoing' | 'missed' | 'rejected' | 'never_attended' | 'not_pickup_by_client'
  durationSec: number
  calledAt: string
}
