'use client'

import { useState, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createMessageTemplateAction, deleteMessageTemplateAction } from './actions'

interface MessageTemplate {
  id: string
  title: string
  body: string
  created_at: string
}

interface MessageTemplatesClientProps {
  templates: MessageTemplate[]
  canManage: boolean
}

const MAX_BODY_LENGTH = 1000

function CreateButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
    >
      {pending ? 'Creating...' : 'Create Template'}
    </button>
  )
}

export function MessageTemplatesClient({ templates, canManage }: MessageTemplatesClientProps) {
  const [state, formAction] = useFormState(createMessageTemplateAction, {})
  const [bodyLength, setBodyLength] = useState(0)
  const [isPending, startTransition] = useTransition()

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteMessageTemplateAction(id)
    })
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="rounded-lg border p-4">
          <h2 className="text-base font-semibold mb-3">Create Template</h2>
          <form action={formAction} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="msg-title" className="text-sm font-medium">Title</label>
              <input
                id="msg-title"
                name="title"
                type="text"
                required
                placeholder="Template title"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <label htmlFor="msg-body" className="text-sm font-medium">Body</label>
                <span className={`text-xs ${bodyLength > MAX_BODY_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {bodyLength} / {MAX_BODY_LENGTH}
                </span>
              </div>
              <textarea
                id="msg-body"
                name="body"
                required
                rows={4}
                maxLength={MAX_BODY_LENGTH}
                placeholder="Message content..."
                onChange={(e) => setBodyLength(e.target.value.length)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {state.error && (
              <p role="alert" className="text-sm text-destructive">{state.error}</p>
            )}
            <CreateButton />
          </form>
        </div>
      )}

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Title</th>
              <th className="px-4 py-3 text-left font-medium">Body</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              {canManage && <th className="px-4 py-3 text-left font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 4 : 3} className="px-4 py-8 text-center text-muted-foreground">
                  No message templates yet.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{t.body}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={isPending}
                        className="text-xs text-destructive hover:underline disabled:opacity-50"
                      >
                        Delete
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
