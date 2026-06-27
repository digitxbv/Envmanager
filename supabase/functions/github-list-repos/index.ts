// GitHub List Repositories Edge Function
// Lists repositories accessible to a GitHub App installation.
//
// POST /github-list-repos
// Body: { installation_id: string }
// Returns: { repositories: [...] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { createGitHubAppJWT } from '../_shared/github-jwt.js'
import { requireEnv } from '../_shared/require-env.ts'

interface ListReposRequest {
  installation_id: string
}

interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  private: boolean
}

async function getInstallationAccessToken(installationId: number, appJwt: string): Promise<string> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appJwt}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get access token: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.token
}

async function listInstallationRepositories(accessToken: string): Promise<GitHubRepository[]> {
  const repositories: GitHubRepository[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const response = await fetch(
      `https://api.github.com/installation/repositories?per_page=${perPage}&page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to list repositories: ${response.status} - ${error}`)
    }

    const data = await response.json()
    const repos = data.repositories || []

    for (const repo of repos) {
      repositories.push({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        owner: { login: repo.owner.login },
        private: repo.private
      })
    }

    if (repos.length < perPage) break
    page++
    if (page > 10) break // Safety limit
  }

  return repositories
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) })
  }

  const corsHeaders = getCorsHeaders(req)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const { user, userClient, error: authError } = await verifyAuth(
    req, supabaseUrl, supabaseAnonKey, supabaseServiceKey
  )

  if (authError || !user) {
    return unauthorizedResponse(corsHeaders, authError || 'Invalid authentication')
  }

  try {
    const body: ListReposRequest = await req.json()
    const { installation_id } = body

    if (!installation_id) {
      return errorResponse('installation_id is required', corsHeaders, 400)
    }

    // Get installation (RLS ensures user has access via organization membership)
    const { data: installation, error: installError } = await userClient
      .from('github_installations')
      .select('id, installation_id, organization_id')
      .eq('id', installation_id)
      .is('uninstalled_at', null)
      .is('suspended_at', null)
      .single()

    if (installError || !installation) {
      console.error('[github-list-repos] Installation not found:', installError)
      return jsonResponse({ repositories: [], error: 'Installation not found or access denied' }, corsHeaders)
    }

    // Get GitHub App credentials
    const appId = Deno.env.get('GITHUB_APP_ID')
    const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY')

    if (!appId || !privateKey) {
      console.error('[github-list-repos] Missing GitHub App credentials')
      return errorResponse('GitHub App not configured', corsHeaders, 500)
    }

    // Create access token and list repositories
    const appJwt = await createGitHubAppJWT(appId, privateKey)
    const accessToken = await getInstallationAccessToken(installation.installation_id, appJwt)
    const repositories = await listInstallationRepositories(accessToken)

    console.log(`[github-list-repos] Found ${repositories.length} repositories`)

    return jsonResponse({ repositories }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
