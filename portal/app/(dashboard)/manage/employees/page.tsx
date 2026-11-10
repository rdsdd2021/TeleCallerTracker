import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { requireRole } from '@/lib/auth/requireRole'
import { getEmployees } from '@/lib/queries/employees'
import { EmployeeTable } from '@/components/manage/EmployeeTable'

export default async function EmployeesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  await requireRole(user.id, orgId, ['owner', 'admin', 'member'])

  const employees = await getEmployees(orgId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Employees</h1>
      <p className="text-sm text-muted-foreground">
        Employees register themselves from the mobile app using your org invite code.
      </p>
      <EmployeeTable employees={employees} orgId={orgId} />
    </div>
  )
}
