import { createClient } from '@/lib/supabase/server'
import { getPeriodRange, getPriorPeriodRange } from '@/lib/utils/periods'
import { computeMetricsWithDelta } from '@/lib/utils/metrics'
import type { DashboardMetrics, Period } from '@/types/domain'

export async function getDashboardMetrics(
  orgId: string,
  period: Period
): Promise<DashboardMetrics> {
  const supabase = createClient()
  const { start, end } = getPeriodRange(period)
  const { start: priorStart, end: priorEnd } = getPriorPeriodRange(period)

  const [currentResult, priorResult] = await Promise.all([
    supabase.rpc('get_dashboard_metrics', {
      p_org_id: orgId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    }),
    supabase.rpc('get_dashboard_metrics', {
      p_org_id: orgId,
      p_start: priorStart.toISOString(),
      p_end: priorEnd.toISOString(),
    }),
  ])

  const current = (currentResult.data as Record<string, number>) ?? {}
  const prior = (priorResult.data as Record<string, number>) ?? {}

  return computeMetricsWithDelta(current, prior)
}
