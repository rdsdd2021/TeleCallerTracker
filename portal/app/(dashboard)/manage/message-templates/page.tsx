import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { MessageTemplatesClient } from './MessageTemplatesClient'

export default async function MessageTemplatesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role) redirect('/dashboard?error=permission_denied')

  const { data: templates } = await supabase
    .from('message_templates')
    .select('id, title, body, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  const canManage = role === 'owner' || role === 'admin'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Message Templates</h1>
      <MessageTemplatesClient templates={templates ?? []} canManage={canManage} />
    </div>
  )
}
