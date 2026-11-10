'use client'

import { useState, useTransition } from 'react'
import { updateOrgNameAction, regenerateInviteCodeAction, deleteOrgAction } from './actions'

interface SettingsClientProps {
  org: { id: string; name: string; invite_code: string; created_at: string }
  userRole: 'owner' | 'admin' | 'member'
  userId: string
}

export function SettingsClient({ org, userRole, userId: _userId }: SettingsClientProps) {
  const [inviteCode, setInviteCode] = useState(org.invite_code)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isPendingInvite, startInviteTransition] = useTransition()

  const [orgName, setOrgName] = useState(org.name)
  const [renameInput, setRenameInput] = useState(org.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameSuccess, setRenameSuccess] = useState(false)
  const [isPendingRename, startRenameTransition] = useTransition()

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isPendingDelete, startDeleteTransition] = useTransition()

  const isOwner = userRole === 'owner'
  const canManageInvite = userRole === 'owner' || userRole === 'admin'

  const formattedDate = new Date(org.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  function handleRegenerateInviteCode() {
    setInviteError(null)
    startInviteTransition(async () => {
      const result = await regenerateInviteCodeAction(org.id)
      if (result.error) {
        setInviteError(result.error)
      } else if (result.inviteCode) {
        setInviteCode(result.inviteCode)
      }
    })
  }

  function handleRenameOrg() {
    setRenameError(null)
    setRenameSuccess(false)
    startRenameTransition(async () => {
      const result = await updateOrgNameAction(org.id, renameInput)
      if (result.error) {
        setRenameError(result.error)
      } else {
        setOrgName(renameInput)
        setRenameSuccess(true)
      }
    })
  }

  function handleDeleteOrg() {
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteOrgAction(org.id, deleteConfirmInput, orgName)
      if (result?.error) {
        setDeleteError(result.error)
      }
    })
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Org Info */}
      <section className="rounded-lg border p-6 space-y-3">
        <h2 className="text-lg font-semibold">Organisation Info</h2>
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-sm text-muted-foreground">Name</dt>
            <dd className="text-sm font-medium">{orgName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-muted-foreground">Created</dt>
            <dd className="text-sm font-medium">{formattedDate}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-muted-foreground">Plan</dt>
            <dd className="text-sm font-medium">Free</dd>
          </div>
        </dl>
      </section>

      {/* Invite Code */}
      <section className="rounded-lg border p-6 space-y-3">
        <h2 className="text-lg font-semibold">Invite Code</h2>
        <p className="text-sm text-muted-foreground">
          Share this code with telecallers so they can join your organisation from the mobile app.
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded bg-muted px-4 py-2 font-mono text-lg tracking-widest select-all">
            {inviteCode}
          </code>
          {canManageInvite && (
            <button
              onClick={handleRegenerateInviteCode}
              disabled={isPendingInvite}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPendingInvite ? 'Regenerating…' : 'Regenerate'}
            </button>
          )}
        </div>
        {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
      </section>

      {/* Rename Org — owner only */}
      {isOwner && (
        <section className="rounded-lg border p-6 space-y-3">
          <h2 className="text-lg font-semibold">Rename Organisation</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={renameInput}
              onChange={(e) => {
                setRenameInput(e.target.value)
                setRenameSuccess(false)
                setRenameError(null)
              }}
              className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Organisation name"
              aria-label="Organisation name"
            />
            <button
              onClick={handleRenameOrg}
              disabled={isPendingRename || !renameInput.trim() || renameInput.trim() === orgName}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPendingRename ? 'Saving…' : 'Save'}
            </button>
          </div>
          {renameError && <p className="text-sm text-destructive">{renameError}</p>}
          {renameSuccess && <p className="text-sm text-green-600">Organisation name updated.</p>}
        </section>
      )}

      {/* Danger Zone — owner only */}
      {isOwner && (
        <section className="rounded-lg border border-destructive/40 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          <p className="text-sm text-muted-foreground">
            Deleting your organisation is permanent. All data will be soft-deleted and you will be
            signed out immediately.
          </p>
          <button
            onClick={() => {
              setDeleteConfirmInput('')
              setDeleteError(null)
              setShowDeleteDialog(true)
            }}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Delete Organisation
          </button>
        </section>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="w-full max-w-md rounded-lg bg-background border p-6 shadow-xl">
            <h3 id="delete-dialog-title" className="text-lg font-semibold mb-2">
              Delete Organisation
            </h3>
            <p className="text-sm text-destructive mb-4">
              This action is irreversible. All organisation data will be soft-deleted.
            </p>
            <label htmlFor="delete-confirm-input" className="block text-sm font-medium mb-1">
              Type the organisation name to confirm
            </label>
            <input
              id="delete-confirm-input"
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => {
                setDeleteConfirmInput(e.target.value)
                setDeleteError(null)
              }}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-destructive mb-4"
              placeholder={orgName}
              autoFocus
            />
            {deleteError && <p className="mb-3 text-sm text-destructive">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isPendingDelete}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteOrg}
                disabled={isPendingDelete || deleteConfirmInput !== orgName}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPendingDelete ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
