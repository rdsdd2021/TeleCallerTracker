import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { RecordingsClient } from './RecordingsClient'

export default async function RecordingsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role) redirect('/dashboard?error=permission_denied')

  // Fetch call logs joined to caller names
  const { data: logs } = await supabase
    .from('call_logs')
    .select(`
      id,
      contact_number,
      called_at,
      duration_sec,
      callers!inner (
        name
      )
    `)
    .eq('org_id', orgId)
    .not('duration_sec', 'eq', 0)
    .order('called_at', { ascending: false })
    .limit(200)

  // Map to recording rows — storage URL pattern: recordings/{org_id}/{call_log_id}.mp3
  const recordings = (logs ?? []).map((log) => {
    const callerName = (log.callers as { name: string } | null)?.name ?? 'Unknown'
    const storagePath = `recordings/${orgId}/${log.id}.mp3`
    const { data: urlData } = supabase.storage.from('recordings').getPublicUrl(storagePath)

    return {
      id: log.id,
      callerName,
      contactNumber: log.contact_number,
      callDate: log.called_at,
      durationSec: log.duration_sec,
      storageUrl: urlData?.publicUrl ?? null,
    }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Call Recordings</h1>
      <RecordingsClient recordings={recordings} orgId={orgId} />
    </div>
  )
}
