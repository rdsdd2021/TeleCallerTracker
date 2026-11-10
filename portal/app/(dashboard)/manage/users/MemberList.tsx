'use client'

import { useTransition } from 'react'
import { removeMemberAction } from './actions'

interface Member {
  id: string
  user_id: string
  email: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
}

interface MemberListProps {
  members: Member[]
  currentUserId: string
  canManage: boolean
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Manager',
  member: 'Member',
}

export function MemberList({ members, currentUserId, canManage }: MemberListProps) {
  const [isPending, startTransition] = useTransition()

  const handleRemove = (memberId: string) => {
    startTransition(async () => {
      await removeMemberAction(memberId)
    })
  }

  return (
    <div className="divide-y">
      {members.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center">
          No members found.
        </p>
      ) : (
        members.map((member) => (
          <div key={member.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium">{member.email}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[member.role] ?? member.role}
                {' · '}
                Joined {new Date(member.created_at).toISOString().slice(0, 10)}
              </p>
            </div>
            {canManage && member.user_id !== currentUserId && member.role !== 'owner' && (
              <button
                onClick={() => handleRemove(member.id)}
                disabled={isPending}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ))
      )}
    </div>
  )
}
