'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useTransition } from 'react'
import { addExcludedNumberAction, deleteExcludedNumberAction } from './actions'

interface ExcludedNumber {
  id: string
  phone_number: string
  created_at: string
}

interface ExcludeNumbersClientProps {
  numbers: ExcludedNumber[]
  canManage: boolean
}

function AddButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Adding...' : 'Add Number'}
    </button>
  )
}

export function ExcludeNumbersClient({ numbers, canManage }: ExcludeNumbersClientProps) {
  const [state, formAction] = useFormState(addExcludedNumberAction, {})
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteExcludedNumberAction(id)
    })
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <form action={formAction} className="flex gap-3 items-end">
          <div className="space-y-1">
            <label htmlFor="phone" className="text-sm font-medium">
              Phone Number (E.164 format)
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              placeholder="+1234567890"
              className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring w-56"
            />
          </div>
          <AddButton />
          {state.error && (
            <p role="alert" className="text-sm text-destructive self-center">
              {state.error}
            </p>
          )}
        </form>
      )}

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Phone Number</th>
              <th className="px-4 py-3 text-left font-medium">Added</th>
              {canManage && <th className="px-4 py-3 text-left font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {numbers.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 3 : 2} className="px-4 py-8 text-center text-muted-foreground">
                  No numbers excluded yet.
                </td>
              </tr>
            ) : (
              numbers.map((n) => (
                <tr key={n.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono">{n.phone_number}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(n.created_at).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(n.id)}
                        disabled={isPending}
                        className="text-xs text-destructive hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
