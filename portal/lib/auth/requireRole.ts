import { redirect } from 'next/navigation'
import { getUserRole } from '@/lib/queries/org'

type Role = 'owner' | 'admin' | 'member'

export async function requireRole(
  userId: string,
  orgId: string,
  allowed: Role[]
): Promise<Role> {
  const role = await getUserRole(userId, orgId)
  if (!role || !allowed.includes(role)) {
    redirect('/dashboard?error=permission_denied')
  }
  return role
}
