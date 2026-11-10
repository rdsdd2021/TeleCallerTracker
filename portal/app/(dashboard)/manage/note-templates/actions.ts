'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'

const MAX_TEMPLATES = 50

export interface TemplateState {
  error?: string
}

export async function createNoteTemplateAction(
  _prevState: TemplateState,
  formData: FormData
): Promise<TemplateState> {
  const title = (formData.get('title') as string)?.trim()
  const body = (formData.get('body') as string)?.trim()

  if (!title || !body) {
    return { error: 'Title and body are required.' }
  }

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

  // Check template count limit
  const { count } = await supabase
    .from('note_templates')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if ((count ?? 0) >= MAX_TEMPLATES) {
    return { error: 'You have reached the maximum of 50 templates.' }
  }

  const { error } = await supabase.from('note_templates').insert({
    org_id: orgId,
    title,
    body,
  })

  if (error) return { error: error.message }

  revalidatePath('/manage/note-templates')
  return {}
}

export async function updateNoteTemplateAction(
  id: string,
  title: string,
  body: string
): Promise<{ error?: string }> {
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
    .from('note_templates')
    .update({ title, body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/manage/note-templates')
  return {}
}

export async function deleteNoteTemplateAction(id: string): Promise<{ error?: string }> {
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
    .from('note_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/manage/note-templates')
  return {}
}
