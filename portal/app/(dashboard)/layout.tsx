import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { DashboardShell } from '@/components/layout/DashboardShell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const orgId = await getOrgId(user.id)

  const [orgResult, memberResult] = await Promise.all([
    supabase.from('organisations').select('name').eq('id', orgId).single(),
    supabase.from('org_members').select('role').eq('user_id', user.id).eq('org_id', orgId).single(),
  ])

  const orgName = orgResult.data?.name ?? 'My Organisation'
  const userRole = memberResult.data?.role ?? 'member'
  const userName = user.email ?? 'User'

  return (
    <DashboardShell orgName={orgName} userName={userName} userRole={userRole}>
      {children}
    </DashboardShell>
  )
}
