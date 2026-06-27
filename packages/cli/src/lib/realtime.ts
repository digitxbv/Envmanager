import { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from './client.js'

export interface VariableChangeEvent {
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  variable_id: string
  key: string
  environment_id: string
  is_secret: boolean
  old_key?: string
  timestamp: number
}

export type VariableChangeCallback = (event: VariableChangeEvent) => void

interface RealtimeSubscription {
  channel: RealtimeChannel
  environmentId: string
  unsubscribe: () => Promise<void>
}

const MAX_RECONNECT_ATTEMPTS = 10
const BASE_RECONNECT_DELAY_MS = 1000

/**
 * SECURITY: Does NOT receive actual values - only metadata.
 * Caller must fetch values via RPC after receiving event.
 */
export async function subscribeToVariableChanges(
  environmentId: string,
  onEvent: VariableChangeCallback,
  onStatus?: (status: 'connected' | 'disconnected' | 'reconnecting' | 'error', message?: string) => void
): Promise<RealtimeSubscription> {
  const client = await createClient()
  
  const { data: envAccess, error: accessError } = await client
    .from('environment_access')
    .select('environment_id')
    .eq('environment_id', environmentId)
    .maybeSingle()
  
  if (accessError || !envAccess) {
    throw new Error(`No access to environment ${environmentId}`)
  }

  const channelName = `variables:${environmentId}`
  let reconnectAttempts = 0
  let reconnectTimeout: NodeJS.Timeout | null = null

  const channel = client.channel(channelName, {
    config: {
      broadcast: { self: false }
    }
  })

  channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'variables'
    },
    (payload) => {
      const newRecord = payload.new as Record<string, unknown> | null
      const oldRecord = payload.old as Record<string, unknown> | null
      const record = (newRecord && Object.keys(newRecord).length > 0 ? newRecord : oldRecord)
      
      if (!record) return
      
      const recordEnvId = record.environment_id as string
      if (recordEnvId !== environmentId) {
        return
      }
      
      const event: VariableChangeEvent = {
        action: payload.eventType.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE',
        variable_id: record.id as string,
        key: record.key as string,
        environment_id: record.environment_id as string,
        is_secret: record.is_secret as boolean,
        timestamp: Date.now() / 1000
      }

      if (payload.eventType === 'UPDATE' && oldRecord) {
        if (oldRecord.key !== record.key) {
          event.old_key = oldRecord.key as string
        }
      }

      onEvent(event)
    }
  )

  // Listen for broadcast events (from trigger or other clients)
  channel.on('broadcast', { event: 'variable_change' }, (payload) => {
    onEvent(payload.payload as VariableChangeEvent)
  })

  // Also listen for any broadcast event name the trigger might use
  channel.on('broadcast', { event: '*' }, (payload) => {
    const data = payload.payload as Record<string, unknown>
    if (data?.action && data?.key && data?.environment_id) {
      onEvent(data as unknown as VariableChangeEvent)
    }
  })

  channel.on('system', { event: '*' }, (status) => {
    if (status.event === 'connected') {
      reconnectAttempts = 0
      onStatus?.('connected')
    }
  })

  const subscription = await new Promise<RealtimeSubscription>((resolve, reject) => {
    channel.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        onStatus?.('connected')
        resolve({
          channel,
          environmentId,
          unsubscribe: async () => {
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout)
            }
            await client.removeChannel(channel)
          }
        })
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1)
          onStatus?.('reconnecting', `Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`)
          
          reconnectTimeout = setTimeout(() => {
            channel.subscribe()
          }, delay)
        } else {
          onStatus?.('error', `Failed after ${MAX_RECONNECT_ATTEMPTS} attempts`)
          reject(new Error(`Failed to subscribe to channel after ${MAX_RECONNECT_ATTEMPTS} attempts: ${err?.message || status}`))
        }
      } else if (status === 'CLOSED') {
        onStatus?.('disconnected')
      }
    })
  })

  return subscription
}

export async function fetchVariableAfterChange(
  environmentId: string,
  variableId: string,
  includeSecrets: boolean = true,
  serviceId?: string
): Promise<{ key: string; value: string | null; is_secret: boolean; tags: string[]; service_id: string | null } | null> {
  const client = await createClient()

  const rpcParams: Record<string, unknown> = {
    p_environment_id: environmentId,
    p_sync_secrets: includeSecrets,
    p_sync_variables: true,
    p_include_fallbacks: false,
    ...(serviceId && { p_service_id: serviceId }),
  }

  const { data: variables, error } = await client.rpc('get_variables_for_sync', rpcParams)

  if (error || !variables) {
    return null
  }

  const variable = (variables as Array<{ id: string; key: string; value: string | null; is_secret: boolean; tags: string[]; service_id: string | null }>)
    .find(v => v.id === variableId)

  return variable || null
}

export async function fetchAllVariables(
  environmentId: string,
  includeSecrets: boolean = true,
  serviceId?: string
): Promise<Array<{ id: string; key: string; value: string | null; is_secret: boolean; tags: string[]; service_id: string | null }>> {
  const client = await createClient()

  const rpcParams: Record<string, unknown> = {
    p_environment_id: environmentId,
    p_sync_secrets: includeSecrets,
    p_sync_variables: true,
    p_include_fallbacks: false,
    ...(serviceId && { p_service_id: serviceId }),
  }

  const { data: variables, error } = await client.rpc('get_variables_for_sync', rpcParams)

  if (error) {
    throw new Error(`Failed to fetch variables: ${error.message}`)
  }

  return (variables || []) as Array<{ id: string; key: string; value: string | null; is_secret: boolean; tags: string[]; service_id: string | null }>
}
