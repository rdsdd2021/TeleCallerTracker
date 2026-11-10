'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'

export async function pinCallLogAction(callLogId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to pin call logs.' }
  }

  const { error } = await supabase.from('pinned_call_logs').insert({
    org_id: orgId,
    call_log_id: callLogId,
    pinned_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { error: 'This call log is already pinned.' }
    return { error: error.message }
  }

  revalidatePath('/manage/pinned-logs')
  return {}
}

export async function unpinCallLogAction(pinnedLogId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to unpin call logs.' }
  }

  const { error } = await supabase
    .from('pinned_call_logs')
    .delete()
    .eq('id', pinnedLogId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/manage/pinned-logs')
  return {}
}
