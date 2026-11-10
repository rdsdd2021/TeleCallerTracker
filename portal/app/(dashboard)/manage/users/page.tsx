import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { AddManagerForm } from './AddManagerForm'
import { MemberList } from './MemberList'
import type { Database } from '@/types/supabase'

export default async function UsersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  const currentUserRole = await getUserRole(user.id, orgId)

  if (!currentUserRole) redirect('/dashboard?error=permission_denied')

  // Fetch org members
  const { data: members } = await supabase
    .from('org_members')
    .select('id, user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  // Resolve emails via service role (auth.users is not accessible via anon key)
  const serviceClient = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const userIds = (members ?? []).map((m) => m.user_id)
  const emailMap: Record<string, string> = {}

  if (userIds.length > 0) {
    const { data: { users: authUsers } } = await serviceClient.auth.admin.listUsers()
    for (const u of authUsers ?? []) {
      if (userIds.includes(u.id)) {
        emailMap[u.id] = u.email ?? u.id
      }
    }
  }

  const membersWithEmail = (members ?? []).map((m) => ({
    ...m,
    email: emailMap[m.user_id] ?? m.user_id,
  }))

  const isOwner = currentUserRole === 'owner'
  const canManage = currentUserRole === 'owner' || currentUserRole === 'admin'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Managers</h1>

      <p className="text-sm text-muted-foreground">
        Managers can access the portal to view dashboards, reports, and manage settings.
        Telecallers register directly from the mobile app using the org invite code.
      </p>

      {isOwner && (
        <div className="rounded-lg border p-4">
          <h2 className="text-base font-semibold mb-1">Add a Manager</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Creates a portal account with admin access. Share the credentials with the manager.
          </p>
          <AddManagerForm />
        </div>
      )}

      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h2 className="text-base font-semibold">Portal Members</h2>
        </div>
        <MemberList
          members={membersWithEmail}
          currentUserId={user.id}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
