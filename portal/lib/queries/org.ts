import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

// React cache() deduplicates within a single request
export const getOrgId = cache(async (userId: string): Promise<string> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .single()
  if (error || !data) throw new Error('Organisation not found')
  return data.org_id
})

export const getUserRole = cache(
  async (userId: string, orgId: string): Promise<'owner' | 'admin' | 'member' | null> => {
    const supabase = createClient()
    const { data } = await supabase
      .from('org_members')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .single()
    return data?.role ?? null
  }
)
