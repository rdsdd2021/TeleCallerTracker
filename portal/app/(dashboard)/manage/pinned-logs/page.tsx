import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { PinnedLogsClient } from './PinnedLogsClient'

export default async function PinnedLogsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role) redirect('/dashboard?error=permission_denied')

  const { data: pinnedLogs } = await supabase
    .from('pinned_call_logs')
    .select(`
      id,
      pinned_by,
      call_logs!inner (
        id,
        contact_number,
        call_type,
        duration_sec,
        called_at,
        callers!inner (
          name
        )
      )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  const logs = (pinnedLogs ?? []).map((p) => {
    const callLog = p.call_logs as {
      id: string
      contact_number: string
      call_type: string
      duration_sec: number
      called_at: string
      callers: { name: string } | null
    }
    return {
      id: p.id,
      callerName: callLog.callers?.name ?? 'Unknown',
      contactNumber: callLog.contact_number,
      callType: callLog.call_type,
      durationSec: callLog.duration_sec,
      callDate: callLog.called_at,
      pinnedByUserId: p.pinned_by,
    }
  })

  const canManage = role === 'owner' || role === 'admin'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pinned Call Logs</h1>
      <PinnedLogsClient logs={logs} canManage={canManage} />
    </div>
  )
}
