import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { ExcludeNumbersClient } from './ExcludeNumbersClient'

export default async function ExcludeNumbersPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role) redirect('/dashboard?error=permission_denied')

  const { data: numbers } = await supabase
    .from('excluded_numbers')
    .select('id, phone_number, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  const canManage = role === 'owner' || role === 'admin'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Exclude Numbers</h1>
      <p className="text-sm text-muted-foreground">
        Numbers in this list are excluded from all dashboard and report calculations.
      </p>
      <ExcludeNumbersClient numbers={numbers ?? []} canManage={canManage} />
    </div>
  )
}
