import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { requireRole } from '@/lib/auth/requireRole'
import { ConnectorsClient } from './ConnectorsClient'

export default async function ConnectorsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  await requireRole(user.id, orgId, ['owner', 'admin'])

  const { data: connectorConfigs } = await supabase
    .from('connector_configs')
    .select('id, connector_type, status, credentials_encrypted, created_at, updated_at')
    .eq('org_id', orgId)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Connectors</h1>
      <ConnectorsClient
        orgId={orgId}
        connectorConfigs={connectorConfigs ?? []}
      />
    </div>
  )
}
