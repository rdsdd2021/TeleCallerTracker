'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import type { Database } from '@/types/supabase'

export interface AddManagerState {
  error?: string
  success?: string
}

/**
 * Creates a new portal account with the 'admin' role and links it to the org.
 * Only owners can add managers.
 */
export async function addManagerAction(
  _prevState: AddManagerState,
  formData: FormData
): Promise<AddManagerState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const orgId = await getOrgId(user.id)
  const userRole = await getUserRole(user.id, orgId)
  if (!userRole || !['owner', 'admin'].includes(userRole)) {
    return { error: 'You do not have permission to add managers.' }
  }

  const serviceClient = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Create the auth account (auto-confirmed — portal is internal)
  const { data: authData, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (
      createError.message.toLowerCase().includes('already registered') ||
      createError.message.toLowerCase().includes('already exists')
    ) {
      return { error: 'An account with this email already exists.' }
    }
    return { error: createError.message }
  }

  if (!authData.user) return { error: 'Failed to create account.' }

  // Link the new user to the org as admin
  const { error: memberError } = await serviceClient
    .from('org_members')
    .insert({
      org_id: orgId,
      user_id: authData.user.id,
      role: 'admin',
    })

  if (memberError) {
    // Rollback the auth account
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    return { error: 'Failed to add manager to organisation.' }
  }

  revalidatePath('/manage/users')
  return { success: `Manager account created for ${email}.` }
}

export async function removeMemberAction(memberId: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const orgId = await getOrgId(user.id)
  const userRole = await getUserRole(user.id, orgId)
  if (!userRole || !['owner', 'admin'].includes(userRole)) {
    return { error: 'You do not have permission to remove members.' }
  }

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('id', memberId)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/manage/users')
  return {}
}
