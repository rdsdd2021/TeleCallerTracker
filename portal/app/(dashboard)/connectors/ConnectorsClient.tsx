'use client'

import { useState, useTransition } from 'react'
import { connectConnectorAction, disconnectConnectorAction } from './actions'

const AVAILABLE_CONNECTORS = [
  {
    type: 'salesforce',
    name: 'Salesforce CRM',
    description: 'Sync call logs to Salesforce contacts and activities.',
  },
  {
    type: 'hubspot',
    name: 'HubSpot CRM',
    description: 'Push call data to HubSpot deals and contacts.',
  },
  {
    type: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Send message templates via WhatsApp Business API.',
  },
]

interface ConnectorConfig {
  id: string
  connector_type: string
  status: 'connected' | 'disconnected' | 'error'
  credentials_encrypted: unknown
  created_at: string
  updated_at: string
}

interface ConnectorsClientProps {
  orgId: string
  connectorConfigs: ConnectorConfig[]
}

interface ConnectorCardProps {
  orgId: string
  type: string
  name: string
  description: string
  config: ConnectorConfig | undefined
}

function StatusBadge({ status }: { status: 'connected' | 'disconnected' | 'error' | undefined }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Connected
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        Reconnection required
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      Not Connected
    </span>
  )
}

function ConnectorCard({ orgId, type, name, description, config }: ConnectorCardProps) {
  const [showForm, setShowForm] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [formError, setFormError] = useState<string | undefined>()
  const [isPending, startTransition] = useTransition()

  const status = config?.status

  const handleConnect = () => {
    setFormError(undefined)
    startTransition(async () => {
      const result = await connectConnectorAction(orgId, type, { apiKey })
      if (result.error) {
        setFormError(result.error)
      } else {
        setShowForm(false)
        setApiKey('')
      }
    })
  }

  const handleDisconnect = () => {
    startTransition(async () => {
      await disconnectConnectorAction(orgId, type)
    })
  }

  const isConnected = status === 'connected' || status === 'error'

  return (
    <div className="rounded-lg border p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{name}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {status === 'error' && (
        <p className="text-sm text-amber-700">
          Reconnection required. Please reconnect this integration to restore functionality.
        </p>
      )}

      <div className="flex gap-2">
        {!isConnected && !showForm && (
          <button
            onClick={() => {
              setShowForm(true)
              setFormError(undefined)
              setApiKey('')
            }}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Connect
          </button>
        )}

        {isConnected && (
          <button
            onClick={handleDisconnect}
            disabled={isPending}
            className="px-4 py-2 text-sm border border-destructive text-destructive rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Disconnecting...' : 'Disconnect'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <label htmlFor={`api-key-${type}`} className="text-sm font-medium">
              API Key
            </label>
            <input
              id={`api-key-${type}`}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={isPending || !apiKey.trim()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Connecting...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setShowForm(false)
                setFormError(undefined)
                setApiKey('')
              }}
              disabled={isPending}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ConnectorsClient({ orgId, connectorConfigs }: ConnectorsClientProps) {
  const configMap = new Map(connectorConfigs.map((c) => [c.connector_type, c]))

  return (
    <div className="space-y-4">
      {AVAILABLE_CONNECTORS.map((connector) => (
        <ConnectorCard
          key={connector.type}
          orgId={orgId}
          type={connector.type}
          name={connector.name}
          description={connector.description}
          config={configMap.get(connector.type)}
        />
      ))}
    </div>
  )
}
