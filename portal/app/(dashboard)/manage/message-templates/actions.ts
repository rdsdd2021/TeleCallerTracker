'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { validateTemplateBody } from '@/lib/utils/validation'

export interface MessageTemplateState {
  error?: string
}

export async function createMessageTemplateAction(
  _prevState: MessageTemplateState,
  formData: FormData
): Promise<MessageTemplateState> {
  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()

  if (!title || !body) {
    return { error: 'Title and body are required.' }
  }

  const bodyError = validateTemplateBody(body)
  if (bodyError) return { error: bodyError }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to manage templates.' }
  }

  const { error } = await supabase.from('message_templates').insert({
    org_id: orgId,
    title,
    body,
  })

  if (error) return { error: error.message }

  revalidatePath('/manage/message-templates')
  return {}
}

export async function deleteMessageTemplateAction(id: string): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const orgId = await getOrgId(user.id)
  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to manage templates.' }
  }

  const { error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/manage/message-templates')
  return {}
}
