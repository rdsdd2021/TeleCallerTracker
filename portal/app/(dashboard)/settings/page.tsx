import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { requireRole } from '@/lib/auth/requireRole'
import { SettingsClient } from './SettingsClient'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  const userRole = await requireRole(user.id, orgId, ['owner', 'admin'])

  const { data: org, error } = await supabase
    .from('organisations')
    .select('id, name, invite_code, created_at')
    .eq('id', orgId)
    .single()

  if (error || !org) redirect('/dashboard?error=org_not_found')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <SettingsClient org={org} userRole={userRole} userId={user.id} />
    </div>
  )
}
