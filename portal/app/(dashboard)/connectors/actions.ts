'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrgId, getUserRole } from '@/lib/queries/org'
import { encrypt } from '@/lib/utils/encryption'
import type { Json } from '@/types/supabase'

export async function connectConnectorAction(
  orgId: string,
  connectorType: string,
  credentials: Record<string, string>
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const userOrgId = await getOrgId(user.id)
  if (userOrgId !== orgId) return { error: 'Unauthorized.' }

  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to manage connectors.' }
  }

  let encryptedPayload
  try {
    encryptedPayload = encrypt(JSON.stringify(credentials))
  } catch {
    return { error: 'Failed to encrypt credentials.' }
  }

  const { error } = await supabase
    .from('connector_configs')
    .upsert(
      {
        org_id: orgId,
        connector_type: connectorType,
        status: 'connected',
        credentials_encrypted: encryptedPayload as unknown as Json,
      },
      { onConflict: 'org_id,connector_type' }
    )

  if (error) return { error: error.message }

  revalidatePath('/connectors')
  return {}
}

export async function disconnectConnectorAction(
  orgId: string,
  connectorType: string
): Promise<{ error?: string }> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized.' }

  const userOrgId = await getOrgId(user.id)
  if (userOrgId !== orgId) return { error: 'Unauthorized.' }

  const role = await getUserRole(user.id, orgId)
  if (!role || !['owner', 'admin'].includes(role)) {
    return { error: 'You do not have permission to manage connectors.' }
  }

  const { error } = await supabase
    .from('connector_configs')
    .update({
      credentials_encrypted: null,
      status: 'disconnected',
    })
    .eq('org_id', orgId)
    .eq('connector_type', connectorType)

  if (error) return { error: error.message }

  revalidatePath('/connectors')
  return {}
}
