'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { addManagerAction } from './actions'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Creating...' : 'Add Manager'}
    </button>
  )
}

export function AddManagerForm() {
  const [state, formAction] = useFormState(addManagerAction, {})

  return (
    <form action={formAction} className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <label htmlFor="manager-email" className="text-sm font-medium">
          Email Address
        </label>
        <input
          id="manager-email"
          name="email"
          type="email"
          required
          placeholder="manager@example.com"
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="manager-password" className="text-sm font-medium">
          Temporary Password
        </label>
        <input
          id="manager-password"
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="Min. 8 characters"
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring w-48"
        />
      </div>
      <SubmitButton />
      {state.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="w-full text-sm text-green-600">
          {state.success}
        </p>
      )}
    </form>
  )
}
