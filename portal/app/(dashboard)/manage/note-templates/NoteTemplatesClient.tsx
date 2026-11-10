'use client'

import { useState, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { createNoteTemplateAction, updateNoteTemplateAction, deleteNoteTemplateAction } from './actions'

interface NoteTemplate {
  id: string
  title: string
  body: string
  updated_at: string
}

interface NoteTemplatesClientProps {
  templates: NoteTemplate[]
  canManage: boolean
}

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

function TemplateCard({
  template,
  canManage,
}: {
  template: NoteTemplate
  canManage: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(template.title)
  const [body, setBody] = useState(template.body)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateNoteTemplateAction(template.id, title, body)
      if (result.error) {
        setError(result.error)
      } else {
        setEditing(false)
      }
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      await deleteNoteTemplateAction(template.id)
    })
  }

  return (
    <div className="rounded-lg border p-4 space-y-2">
      {editing ? (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Template title"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="w-full px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Template body"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setTitle(template.title)
                setBody(template.body)
              }}
              className="px-3 py-1 text-xs border rounded hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="font-medium text-sm">{template.title}</p>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{template.body}</p>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(template.updated_at).toLocaleDateString()}
          </p>
          {canManage && (
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-primary hover:underline"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function NoteTemplatesClient({ templates, canManage }: NoteTemplatesClientProps) {
  const [state, formAction] = useFormState(createNoteTemplateAction, {})

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="rounded-lg border p-4">
          <h2 className="text-base font-semibold mb-3">Create Template</h2>
          <form action={formAction} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="tmpl-title" className="text-sm font-medium">
                Title
              </label>
              <input
                id="tmpl-title"
                name="title"
                type="text"
                required
                placeholder="Template title"
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="tmpl-body" className="text-sm font-medium">
                Body
              </label>
              <textarea
                id="tmpl-body"
                name="body"
                required
                rows={3}
                placeholder="Template content..."
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {state.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            <CreateButton />
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground col-span-2">No templates yet.</p>
        ) : (
          templates.map((t) => <TemplateCard key={t.id} template={t} canManage={canManage} />)
        )}
      </div>
    </div>
  )
}
