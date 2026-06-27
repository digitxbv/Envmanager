// Azure Key Vault Credential Validation Edge Function
// Validates Azure AD app credentials and Key Vault access
//
// POST /azure-validate
// Body: { tenant_id: string, client_id: string, client_secret: string, vault_url: string }
// Returns: { valid: boolean, vault_name: string, error?: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'
import { logError } from '../_shared/logger.js'
import { getAzureAccessToken } from '../_shared/cloud-auth.ts'

interface ValidateRequest {
  tenant_id: string
  client_id: string
  client_secret: string
  vault_url: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  // Verify authenticated user
  const { user, error: authError } = await verifyAuth(
    req, supabaseUrl, supabaseAnonKey, supabaseServiceKey
  )

  if (authError || !user) {
    return unauthorizedResponse(corsHeaders, authError || 'Invalid authentication')
  }

  try {
    const body: ValidateRequest = await req.json()
    const { tenant_id, client_id, client_secret, vault_url } = body

    if (!tenant_id) {
      return errorResponse('Tenant ID is required', corsHeaders, 400)
    }

    if (!client_id) {
      return errorResponse('Client ID is required', corsHeaders, 400)
    }

    if (!client_secret) {
      return errorResponse('Client Secret is required', corsHeaders, 400)
    }

    if (!vault_url) {
      return errorResponse('Vault URL is required', corsHeaders, 400)
    }

    // Validate vault URL format and prevent SSRF
    let parsedUrl: URL
    try {
      parsedUrl = new URL(vault_url)
    } catch {
      return errorResponse('Invalid vault URL format. Expected: https://<vault-name>.vault.azure.net', corsHeaders, 400)
    }

    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.vault.azure.net')) {
      return errorResponse(
        'Invalid vault URL format. Expected: https://<vault-name>.vault.azure.net',
        corsHeaders,
        400
      )
    }

    // Reconstruct clean URL to prevent SSRF via path/query manipulation
    const cleanVaultUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`

    // Extract vault name from URL (e.g., https://myvault.vault.azure.net -> myvault)
    const vaultName = parsedUrl.hostname.split('.vault.azure.net')[0]

    console.log(`[azure-validate] Validating credentials for vault: ${vaultName}, tenant: ${tenant_id}`)

    // 1. Get access token
    let accessToken: string
    try {
      accessToken = await getAzureAccessToken(
        tenant_id,
        client_id,
        client_secret,
        'https://vault.azure.net/.default'
      )
    } catch (err) {
      logError(err, { functionName: 'azure-validate', context: 'token_generation' })
      return jsonResponse({
        valid: false,
        vault_name: vaultName,
        error: 'Failed to authenticate with Azure. Check your tenant ID, client ID, and client secret.'
      }, corsHeaders)
    }

    // 2. Validate Key Vault API access
    const kvResponse = await fetch(
      `${cleanVaultUrl}/secrets?api-version=7.4&maxresults=1`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!kvResponse.ok) {
      const status = kvResponse.status
      const errorBody = await kvResponse.text()
      logError(new Error(`Key Vault API error (${status}): ${errorBody}`), { functionName: 'azure-validate', context: 'kv_access_check' })

      let errorMsg = `Key Vault API error: ${status}`
      if (status === 401 || status === 403) {
        errorMsg = 'Permission denied. Ensure the app registration has the Key Vault Secrets Officer role.'
      } else if (status === 404) {
        errorMsg = 'Key Vault not found. Check the vault URL.'
      }

      return jsonResponse({
        valid: false,
        vault_name: vaultName,
        error: errorMsg
      }, corsHeaders)
    }

    console.log(`[azure-validate] Credentials valid for vault: ${vaultName}`)

    return jsonResponse({
      valid: true,
      vault_name: vaultName
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
