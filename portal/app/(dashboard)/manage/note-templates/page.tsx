import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { NoteTemplatesClient } from './NoteTemplatesClient'

export default async function NoteTemplatesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role) redirect('/dashboard?error=permission_denied')

  const { data: templates } = await supabase
    .from('note_templates')
    .select('id, title, body, updated_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  const canManage = role === 'owner' || role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Note Templates</h1>
        <span className="text-sm text-muted-foreground">
          {templates?.length ?? 0} / 50 templates
        </span>
      </div>
      <NoteTemplatesClient templates={templates ?? []} canManage={canManage} />
    </div>
  )
}
