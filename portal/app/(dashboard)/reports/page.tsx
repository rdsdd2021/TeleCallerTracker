import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getOrgId } from '@/lib/queries/org'
import { CompactReportsContainer } from '@/components/reports/CompactReportsContainer'

export default async function ReportsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const orgId = await getOrgId(user.id)

  return <CompactReportsContainer orgId={orgId} />
}
