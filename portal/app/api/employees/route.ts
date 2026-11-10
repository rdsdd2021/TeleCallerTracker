import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { insertEmployee } from '@/lib/queries/employees'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const orgId = await getOrgId(user.id)
    
    const { data: employees, error } = await supabase
      .from('callers')
      .select('id, name, employee_id')
      .eq('org_id', orgId)
      .order('name')

    if (error) {
      console.error('Error fetching employees:', error)
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
    }

    return NextResponse.json(employees || [])
  } catch (error) {
    console.error('Error fetching employees:', error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = await getOrgId(user.id)
  const body = await request.json()
  const { name, employeeId } = body

  if (!name || !employeeId) {
    return NextResponse.json({ error: 'Name and Employee ID are required.' }, { status: 400 })
  }

  const result = await insertEmployee(orgId, name, employeeId)
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
