// AWS Credential Validation Edge Function
// Validates AWS IAM credentials via STS GetCallerIdentity
//
// POST /aws-validate
// Body: { access_key_id: string, secret_access_key: string, region: string }
// Returns: { valid: boolean, account_id: string, region: string, error?: string }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { requireEnv } from '../_shared/require-env.ts'
import { logError, logInfo } from '../_shared/logger.js'
import { signAwsRequest } from '../_shared/cloud-auth.ts'

const VALID_AWS_REGIONS = new Set([
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'af-south-1',
  'ap-east-1', 'ap-south-1', 'ap-south-2', 'ap-southeast-1', 'ap-southeast-2',
  'ap-southeast-3', 'ap-southeast-4', 'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ca-central-1', 'ca-west-1',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-south-1', 'eu-south-2', 'eu-north-1',
  'il-central-1',
  'me-south-1', 'me-central-1',
  'sa-east-1',
])

interface ValidateRequest {
  access_key_id: string
  secret_access_key: string
  region: string
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
    const { access_key_id, secret_access_key, region } = body

    if (!access_key_id) {
      return errorResponse('Access Key ID is required', corsHeaders, 400)
    }

    if (!secret_access_key) {
      return errorResponse('Secret Access Key is required', corsHeaders, 400)
    }

    if (!region) {
      return errorResponse('Region is required', corsHeaders, 400)
    }

    if (!VALID_AWS_REGIONS.has(region)) {
      return errorResponse('Invalid AWS region', corsHeaders, 400)
    }

    logInfo(`Validating credentials for region: ${region}`, { functionName: 'aws-validate' })

    // Call STS GetCallerIdentity to verify credentials
    const stsEndpoint = `https://sts.${region}.amazonaws.com/`
    const requestBody = 'Action=GetCallerIdentity&Version=2011-06-15'

    const signedHeaders = await signAwsRequest(
      access_key_id, secret_access_key, region, 'sts',
      {
        method: 'POST',
        url: stsEndpoint,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: requestBody,
      }
    )

    const res = await fetch(stsEndpoint, {
      method: 'POST',
      headers: { ...signedHeaders, 'content-type': 'application/x-www-form-urlencoded' },
      body: requestBody,
    })

    if (!res.ok) {
      const errorBody = await res.text()
      logError(new Error(`STS validation failed: ${res.status}`), { functionName: 'aws-validate', responseBody: errorBody })
      return jsonResponse({
        valid: false,
        account_id: '',
        region,
        error: 'Invalid AWS credentials. Check your Access Key ID and Secret Access Key.'
      }, corsHeaders)
    }

    const xml = await res.text()
    const match = xml.match(/<Account>(\d+)<\/Account>/)

    if (!match) {
      logError(new Error('Failed to parse Account from STS response'), { functionName: 'aws-validate', responseBody: xml })
      return jsonResponse({
        valid: false,
        account_id: '',
        region,
        error: 'Failed to parse AWS response'
      }, corsHeaders)
    }

    const accountId = match[1]
    logInfo(`Credentials valid for account: ${accountId}, region: ${region}`, { functionName: 'aws-validate' })

    return jsonResponse({
      valid: true,
      account_id: accountId,
      region,
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
