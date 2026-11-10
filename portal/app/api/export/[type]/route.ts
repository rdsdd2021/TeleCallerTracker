import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmployees } from '@/lib/queries/employees'
import { getEmployeeReport } from '@/lib/queries/reports'
import {
  generateEmployeeCSV,
  generateReportCSV,
  type EmployeeCSVRow,
} from '@/lib/utils/export'

// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  // Authenticate
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const orgId = searchParams.get('orgId') ?? ''
  const type = params.type

  const today = new Date().toISOString().slice(0, 10)

  if (type === 'employees') {
    const employees = await getEmployees(orgId)

    const csvRows: EmployeeCSVRow[] = employees.map((emp) => ({
      name: emp.name,
      employeeId: emp.employeeId,
      deviceId: emp.deviceId ?? '',
      registrationDate: new Date(emp.registrationDate).toLocaleDateString(),
      lastSync: emp.lastSync ? new Date(emp.lastSync).toLocaleDateString() : 'Never synced',
    }))

    const csv = generateEmployeeCSV(csvRows)

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="employees.csv"',
      },
    })
  }

  if (type === 'reports') {
    const start = searchParams.get('start') ?? today
    const end = searchParams.get('end') ?? today

    const reportRows = await getEmployeeReport(orgId, start, end)
    const csv = generateReportCSV(reportRows)

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="reports.csv"',
      },
    })
  }

  return new Response('Unknown export type', { status: 400 })
}
