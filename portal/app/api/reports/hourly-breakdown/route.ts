import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const orgId = await getOrgId(user.id)
    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end   = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json({ error: 'Missing start or end' }, { status: 400 })
    }

    const { data, error } = await (supabase.rpc as any)('get_hourly_employee_breakdown', {
      p_org_id: orgId,
      p_start:  start,
      p_end:    end,
    })

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[hourly-breakdown]', err)
    return NextResponse.json({ error: 'Failed to fetch hourly breakdown' }, { status: 500 })
  }
}
