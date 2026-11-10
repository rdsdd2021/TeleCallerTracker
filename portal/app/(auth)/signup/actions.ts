'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { generateInviteCode } from '@/lib/utils/inviteCode'
import type { Database } from '@/types/supabase'

export interface SignUpState {
  error?: string
}

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const orgName = formData.get('orgName') as string

  // Validate inputs
  if (!email || !email.includes('@')) {
    return { error: 'Please enter a valid email address.' }
  }
  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (!orgName || orgName.trim().length === 0) {
    return { error: 'Organisation name is required.' }
  }

  // Use service role to create user with email pre-confirmed
  // (portal is a managed internal tool — no email confirmation needed)
  const serviceClient = createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const supabase = createClient()

  // Step 1: Create the auth account (auto-confirmed via admin API)
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    if (
      authError.message.toLowerCase().includes('already registered') ||
      authError.message.toLowerCase().includes('already exists') ||
      authError.status === 422
    ) {
      return { error: 'An account with this email already exists.' }
    }
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Sign up failed. Please try again.' }
  }

  const userId = authData.user.id
  const inviteCode = generateInviteCode()

  // Step 2: Create org and owner membership atomically via RPC
  const { error: rpcError } = await supabase.rpc('create_org_with_owner', {
    p_name: orgName.trim(),
    p_invite_code: inviteCode,
    p_user_id: userId,
  })

  if (rpcError) {
    // Rollback: delete the auth user since org creation failed
    await serviceClient.auth.admin.deleteUser(userId)
    return { error: 'Failed to create organisation. Please try again.' }
  }

  // Step 3: Sign the user in to establish a session
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) {
    return { error: signInError.message }
  }

  redirect('/dashboard')
}
