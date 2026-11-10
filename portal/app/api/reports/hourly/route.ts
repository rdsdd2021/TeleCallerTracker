import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { getHourlyMetrics } from '@/lib/queries/reports'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

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
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: start, end' },
        { status: 400 }
      )
    }

    const hourlyMetrics = await getHourlyMetrics(orgId, start, end)
    return NextResponse.json(hourlyMetrics)
  } catch (error) {
    console.error('Error fetching hourly metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch hourly metrics' },
      { status: 500 }
    )
  }
}