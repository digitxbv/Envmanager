// =====================================================
// GitHub Webhook Handler Edge Function
// =====================================================
// Handles webhooks from the GitHub App, including:
// - installation (installed, uninstalled, suspended)
// - installation_repositories (added, removed)
//
// Deploy with: supabase functions deploy github-webhook --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logError } from '../_shared/logger.js'

// =====================================================
// Types
// =====================================================

interface WebhookPayload {
  action: string
  installation?: {
    id: number
    account: {
      login: string
      id: number
      type: 'User' | 'Organization'
    }
    suspended_at?: string | null
  }
  repositories_added?: Array<{ id: number; name: string; full_name: string }>
  repositories_removed?: Array<{ id: number; name: string; full_name: string }>
  sender?: {
    login: string
    id: number
  }
}

// =====================================================
// Webhook Signature Verification
// =====================================================

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  )
  
  const expectedSignature = 'sha256=' + Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  // Timing-safe comparison
  if (expectedSignature.length !== signature.length) {
    return false
  }
  
  let result = 0
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  
  return result === 0
}

// =====================================================
// Event Handlers
// =====================================================

async function handleInstallationCreated(
  supabase: any,
  payload: WebhookPayload
): Promise<void> {
  // Installation created events are handled by the OAuth callback
  // This is just a backup/audit mechanism
  console.log('[github-webhook] Installation created:', payload.installation?.id)
}

async function handleInstallationDeleted(
  supabase: any,
  payload: WebhookPayload
): Promise<void> {
  const installationId = payload.installation?.id
  
  if (!installationId) {
    console.error('[github-webhook] Missing installation ID in delete event')
    return
  }
  
  console.log('[github-webhook] Installation deleted:', installationId)
  
  // Mark installation as uninstalled
  const { error } = await supabase
    .from('github_installations')
    .update({
      uninstalled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('installation_id', installationId)
  
  if (error) {
    console.error('[github-webhook] Failed to mark installation as uninstalled:', error)
    return
  }
  
  // Also delete all project sync configs for this installation
  // (CASCADE will remove env configs and synced keys)
  const { data: installation } = await supabase
    .from('github_installations')
    .select('id')
    .eq('installation_id', installationId)
    .single()
  
  if (installation) {
    await supabase
      .from('github_project_sync_configs')
      .delete()
      .eq('installation_id', installation.id)
  }
  
  console.log('[github-webhook] Installation marked as uninstalled')
}

async function handleInstallationSuspended(
  supabase: any,
  payload: WebhookPayload
): Promise<void> {
  const installationId = payload.installation?.id
  const suspendedAt = payload.installation?.suspended_at
  
  if (!installationId) {
    console.error('[github-webhook] Missing installation ID in suspend event')
    return
  }
  
  console.log('[github-webhook] Installation suspended:', installationId)
  
  const { error } = await supabase
    .from('github_installations')
    .update({
      suspended_at: suspendedAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('installation_id', installationId)
  
  if (error) {
    console.error('[github-webhook] Failed to mark installation as suspended:', error)
  }
}

async function handleInstallationUnsuspended(
  supabase: any,
  payload: WebhookPayload
): Promise<void> {
  const installationId = payload.installation?.id
  
  if (!installationId) {
    console.error('[github-webhook] Missing installation ID in unsuspend event')
    return
  }
  
  console.log('[github-webhook] Installation unsuspended:', installationId)
  
  const { error } = await supabase
    .from('github_installations')
    .update({
      suspended_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('installation_id', installationId)
  
  if (error) {
    console.error('[github-webhook] Failed to unsuspend installation:', error)
  }
}

async function handleRepositoriesChanged(
  supabase: any,
  payload: WebhookPayload
): Promise<void> {
  // Log repository access changes for audit purposes
  // The actual repository list is fetched dynamically from GitHub API
  console.log('[github-webhook] Repositories changed for installation:', payload.installation?.id)
  
  if (payload.repositories_added?.length) {
    console.log('[github-webhook] Repositories added:', 
      payload.repositories_added.map(r => r.full_name).join(', '))
  }
  
  if (payload.repositories_removed?.length) {
    console.log('[github-webhook] Repositories removed:', 
      payload.repositories_removed.map(r => r.full_name).join(', '))
    
    // If a repository was removed, delete any env configs pointing to it
    const installationId = payload.installation?.id
    
    if (installationId) {
      const { data: installation } = await supabase
        .from('github_installations')
        .select('id')
        .eq('installation_id', installationId)
        .single()
      
      if (installation) {
        const { data: projectConfigs, error: projectError } = await supabase
          .from('github_project_sync_configs')
          .select('id')
          .eq('installation_id', installation.id)

        if (projectError) {
          console.error('[github-webhook] Failed to load project configs for installation:', projectError)
          return
        }

        const projectConfigIds = (projectConfigs || []).map((config: { id: string }) => config.id)
        if (projectConfigIds.length === 0) return

        for (const repo of payload.repositories_removed) {
          const [owner, name] = repo.full_name.split('/')

          const { error } = await supabase
            .from('github_environment_configs')
            .delete()
            .in('project_sync_config_id', projectConfigIds)
            .eq('target_config->>repo_owner', owner)
            .eq('target_config->>repo_name', name)

          if (error) {
            console.error('[github-webhook] Failed to delete env configs for removed repo:', error)
          } else {
            console.log('[github-webhook] Deleted env configs for removed repo:', repo.full_name)
          }
        }
      }
    }
  }
}

// =====================================================
// Main Handler
// =====================================================

serve(async (req: Request) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  
  try {
    // Get webhook signature
    const signature = req.headers.get('x-hub-signature-256')
    const event = req.headers.get('x-github-event')
    const deliveryId = req.headers.get('x-github-delivery')
    
    if (!signature) {
      console.error('[github-webhook] Missing signature')
      return new Response('Missing signature', { status: 401 })
    }
    
    if (!event) {
      console.error('[github-webhook] Missing event type')
      return new Response('Missing event type', { status: 400 })
    }
    
    // Get raw body for signature verification
    const body = await req.text()
    
    // Verify webhook signature
    const webhookSecret = Deno.env.get('GITHUB_WEBHOOK_SECRET')
    
    if (!webhookSecret) {
      console.error('[github-webhook] Missing webhook secret configuration')
      return new Response('Server configuration error', { status: 500 })
    }
    
    const isValid = await verifyWebhookSignature(body, signature, webhookSecret)
    
    if (!isValid) {
      console.error('[github-webhook] Invalid signature')
      return new Response('Invalid signature', { status: 401 })
    }
    
    // Parse payload
    const payload: WebhookPayload = JSON.parse(body)
    
    console.log(`[github-webhook] Received ${event}.${payload.action} (delivery: ${deliveryId})`)
    
    // Create Supabase service role client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Route to appropriate handler
    switch (event) {
      case 'installation':
        switch (payload.action) {
          case 'created':
            await handleInstallationCreated(supabase, payload)
            break
          case 'deleted':
            await handleInstallationDeleted(supabase, payload)
            break
          case 'suspend':
            await handleInstallationSuspended(supabase, payload)
            break
          case 'unsuspend':
            await handleInstallationUnsuspended(supabase, payload)
            break
          default:
            console.log(`[github-webhook] Unhandled installation action: ${payload.action}`)
        }
        break
        
      case 'installation_repositories':
        await handleRepositoriesChanged(supabase, payload)
        break
        
      default:
        console.log(`[github-webhook] Unhandled event: ${event}`)
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    logError(error, { functionName: 'github-webhook' })
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
