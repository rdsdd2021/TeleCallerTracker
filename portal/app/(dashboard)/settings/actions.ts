'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { generateInviteCode } from '@/lib/utils/inviteCode'

export async function updateOrgNameAction(
  orgId: string,
  name: string
): Promise<{ error?: string }> {
  if (!name || !name.trim()) {
    return { error: 'Organisation name cannot be empty.' }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const userOrgId = await getOrgId(user.id)
  if (userOrgId !== orgId) return { error: 'Unauthorized.' }

  const role = await getUserRole(user.id, orgId)
  if (role !== 'owner') {
    return { error: 'Only the organisation owner can rename the organisation.' }
  }

  const { error } = await supabase
    .from('organisations')
    .update({ name: name.trim() })
    .eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return {}
}

export async function regenerateInviteCodeAction(
  orgId: string
): Promise<{ error?: string; inviteCode?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const userOrgId = await getOrgId(user.id)
  if (userOrgId !== orgId) return { error: 'Unauthorized.' }

  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to regenerate the invite code.' }
  }

  const inviteCode = generateInviteCode()

  const { error } = await supabase
    .from('organisations')
    .update({ invite_code: inviteCode })
    .eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/settings')
  return { inviteCode }
}

export async function deleteOrgAction(
  orgId: string,
  confirmName: string,
  orgName: string
): Promise<{ error?: string }> {
  if (confirmName !== orgName) {
    return { error: 'Organisation name does not match.' }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const userOrgId = await getOrgId(user.id)
  if (userOrgId !== orgId) return { error: 'Unauthorized.' }

  const role = await getUserRole(user.id, orgId)
  if (role !== 'owner') {
    return { error: 'Only the organisation owner can delete the organisation.' }
  }

  const { error } = await supabase
    .from('organisations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', orgId)

  if (error) return { error: error.message }

  await supabase.auth.signOut()
  redirect('/login')
}
