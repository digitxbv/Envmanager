// GCP Service Account Validation Edge Function
// Validates GCP service account JSON key and Secret Manager API access
//
// POST /gcp-validate
// Body: { service_account_json: string, project_id: string }
// Returns: { valid: boolean, project_id: string, service_account_email: string, error?: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'
import { logError, logInfo } from '../_shared/logger.js'
import { getGcpAccessToken } from '../_shared/cloud-auth.ts'

interface ValidateRequest {
  service_account_json: string
  project_id: string
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
    const { service_account_json, project_id } = body

    if (!service_account_json) {
      return errorResponse('Service account JSON is required', corsHeaders, 400)
    }

    if (!project_id) {
      return errorResponse('Project ID is required', corsHeaders, 400)
    }

    // Validate project_id format (alphanumeric project ID or numeric project number)
    const validProjectId = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project_id) || /^\d+$/.test(project_id)
    if (!validProjectId) {
      return errorResponse('Invalid GCP project ID format', corsHeaders, 400)
    }

    // Parse service account JSON
    let sa: any
    try {
      sa = JSON.parse(service_account_json)
    } catch {
      return errorResponse('Invalid JSON format', corsHeaders, 400)
    }

    const { client_email, private_key } = sa
    if (!client_email || !private_key) {
      return errorResponse('Service account JSON must contain client_email and private_key', corsHeaders, 400)
    }

    logInfo(`Validating credentials for project: ${project_id}`, { functionName: 'gcp-validate' })

    // 1. Get access token
    let accessToken: string
    try {
      accessToken = await getGcpAccessToken(service_account_json)
    } catch (err) {
      logError(err, { functionName: 'gcp-validate', context: 'token_generation' })
      return jsonResponse({
        valid: false,
        project_id,
        service_account_email: client_email,
        error: 'Failed to authenticate with GCP. Check your service account credentials.'
      }, corsHeaders)
    }

    // 2. Validate Secret Manager API access
    const smResponse = await fetch(
      `https://secretmanager.googleapis.com/v1/projects/${project_id}/secrets?pageSize=1`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    )

    if (!smResponse.ok) {
      const status = smResponse.status
      const errorBody = await smResponse.text()
      logError(new Error(`Secret Manager API error (${status}): ${errorBody}`), { functionName: 'gcp-validate', context: 'secret_manager_api' })

      let errorMsg = `Secret Manager API error: ${status}`
      if (status === 403) {
        errorMsg = 'Permission denied. Ensure the service account has the Secret Manager Admin role.'
      } else if (status === 404) {
        errorMsg = 'Project not found or Secret Manager API is not enabled.'
      }

      return jsonResponse({
        valid: false,
        project_id,
        service_account_email: client_email,
        error: errorMsg
      }, corsHeaders)
    }

    logInfo(`Credentials valid for project: ${project_id}`, { functionName: 'gcp-validate' })

    return jsonResponse({
      valid: true,
      project_id,
      service_account_email: client_email
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
