import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { getDashboardMetrics } from '@/lib/queries/dashboard'
import { PeriodSelector } from '@/components/dashboard/PeriodSelector'

export default async function DashboardPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  const metrics = await getDashboardMetrics(orgId, 'today')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <PeriodSelector orgId={orgId} initialPeriod="today" initialMetrics={metrics} />
    </div>
  )
}
