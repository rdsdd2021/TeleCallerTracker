'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { isValidE164PhoneNumber } from '@/lib/utils/validation'

export interface ExcludeNumberState {
  error?: string
}

export async function addExcludedNumberAction(
  _prevState: ExcludeNumberState,
  formData: FormData
): Promise<ExcludeNumberState> {
  const phone = (formData.get('phone') as string)?.trim()

  if (!phone || !isValidE164PhoneNumber(phone)) {
    return { error: 'Please enter a valid phone number.' }
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to manage excluded numbers.' }
  }

  const { error } = await supabase.from('excluded_numbers').insert({
    org_id: orgId,
    phone_number: phone,
  })

  if (error) {
    if (error.code === '23505') {
      return { error: 'This number is already in the exclusion list.' }
    }
    return { error: error.message }
  }

  revalidatePath('/manage/exclude-numbers')
  return {}
}

export async function deleteExcludedNumberAction(id: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to manage excluded numbers.' }
  }

  const { error } = await supabase
    .from('excluded_numbers')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/manage/exclude-numbers')
  return {}
}
