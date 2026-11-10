import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { getDashboardMetrics } from '@/lib/queries/dashboard'
import type { Period } from '@/types/domain'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

const VALID_PERIODS: Period[] = ['today', 'yesterday', 'last_week']

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') as Period | null
  const orgIdParam = searchParams.get('orgId')

  if (!period || !VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify the orgId belongs to the authenticated user
  const orgId = await getOrgId(user.id)
  if (orgIdParam && orgIdParam !== orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const metrics = await getDashboardMetrics(orgId, period)
  return NextResponse.json(metrics)
}
