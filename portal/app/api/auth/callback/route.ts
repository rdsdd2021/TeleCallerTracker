import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check if this is an invited user who needs an org_members row
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user?.user_metadata?.org_id && user?.user_metadata?.role) {
        const orgId = user.user_metadata.org_id as string
        const role = user.user_metadata.role as 'admin' | 'member'

        // Check if org_members row already exists (idempotent)
        const { data: existing } = await supabase
          .from('org_members')
          .select('id')
          .eq('user_id', user.id)
          .eq('org_id', orgId)
          .maybeSingle()

        if (!existing) {
          await supabase.from('org_members').insert({
            org_id: orgId,
            user_id: user.id,
            role,
          })
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
