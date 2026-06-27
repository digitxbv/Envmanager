// Railway List Resources Edge Function
// Lists projects, services, and environments for a connected Railway account
//
// POST /railway-list-resources
// Body: { connection_id: string, workspace_id?: string }
// Returns: { workspace: {...}, projects: [...] }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.js'
import { verifyAuth } from '../_shared/auth.js'
import { jsonResponse, errorResponse, unauthorizedResponse, notFoundResponse } from '../_shared/response.js'
import { handleError } from '../_shared/errors.js'
import { logError } from '../_shared/logger.js'
import { requireEnv } from '../_shared/require-env.ts'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'

interface ListResourcesRequest {
  connection_id: string
  workspace_id?: string
}

interface RailwayService {
  id: string
  name: string
}

interface RailwayEnvironment {
  id: string
  name: string
}

interface RailwayProject {
  id: string
  name: string
  services: RailwayService[]
  environments: RailwayEnvironment[]
}

// GraphQL query to get workspaces (fallback when no workspace_id provided)
// Note: workspaces is a direct array, NOT edges/node format
const ME_WORKSPACES_QUERY = `
  query {
    me {
      workspaces {
        id
        name
      }
    }
  }
`

// GraphQL query to get projects for a workspace
// Uses workspace(workspaceId:) - note the different parameter name from team(id:)
const WORKSPACE_PROJECTS_QUERY = `
  query WorkspaceProjects($workspaceId: String!) {
    workspace(workspaceId: $workspaceId) {
      id
      name
      projects {
        edges {
          node {
            id
            name
            services {
              edges {
                node {
                  id
                  name
                }
              }
            }
            environments {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`

async function railwayQuery<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  // IMPORTANT: Add ?source=envmanager to bypass Cloudflare 10 RPS hidden limit
  const response = await fetch(`${RAILWAY_API}?source=envmanager`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Railway API error: ${response.status} - ${text}`)
  }

  return response.json()
}

// Parse projects from GraphQL edge/node format
function parseProjects(edges: Array<{ node: any }>): RailwayProject[] {
  return edges.map(({ node }) => ({
    id: node.id,
    name: node.name,
    services: (node.services?.edges || []).map((e: any) => ({
      id: e.node.id,
      name: e.node.name
    })),
    environments: (node.environments?.edges || []).map((e: any) => ({
      id: e.node.id,
      name: e.node.name
    }))
  }))
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
  const { user, userClient, serviceClient, error: authError } = await verifyAuth(
    req, supabaseUrl, supabaseAnonKey, supabaseServiceKey
  )

  if (authError || !user) {
    return unauthorizedResponse(corsHeaders, authError || 'Invalid authentication')
  }

  try {
    const body: ListResourcesRequest = await req.json()
    const { connection_id, workspace_id } = body

    if (!connection_id) {
      return errorResponse('connection_id is required', corsHeaders, 400)
    }

    console.log('[railway-list-resources] Listing resources for connection:', connection_id)

    // Get connection (RLS ensures access)
    const { data: connection, error: connError } = await userClient
      .from('platform_integrations')
      .select('*')
      .eq('id', connection_id)
      .eq('platform', 'railway')
      .is('disconnected_at', null)
      .single()

    if (connError || !connection) {
      return notFoundResponse(corsHeaders, 'Railway connection not found')
    }

    // Get token from Vault
    const { data: token, error: vaultError } = await serviceClient
      .rpc('get_vault_secret', { secret_id: connection.api_token_vault_id })

    if (vaultError || !token) {
      logError(vaultError, { functionName: 'railway-list-resources', context: 'get_vault_secret' })
      return errorResponse('Failed to retrieve credentials', corsHeaders, 500)
    }

    // Determine which workspace to query
    let targetWorkspaceId = workspace_id

    // If no workspace_id provided, check connection metadata or query workspaces
    if (!targetWorkspaceId) {
      // Check if connection has stored workspace ID
      const metadata = connection.metadata as { workspaceId?: string } | null
      if (metadata?.workspaceId) {
        targetWorkspaceId = metadata.workspaceId
        console.log('[railway-list-resources] Using stored workspace ID:', targetWorkspaceId)
      } else {
        // Query workspaces and use the first one
        const workspacesResult = await railwayQuery<{
          me: { workspaces: Array<{ id: string; name: string }> }
        }>(token, ME_WORKSPACES_QUERY)

        if (workspacesResult.errors) {
          logError(workspacesResult.errors, { functionName: 'railway-list-resources', context: 'workspaces_query' })
          return errorResponse(workspacesResult.errors[0].message, corsHeaders, 400)
        }

        const workspaces = workspacesResult.data?.me?.workspaces || []
        if (workspaces.length === 0) {
          return jsonResponse({
            workspace: null,
            workspaces: [],
            projects: [],
            error: 'No workspaces found for this account'
          }, corsHeaders)
        }

        // Use first workspace
        targetWorkspaceId = workspaces[0].id
        console.log('[railway-list-resources] Using first workspace:', workspaces[0].name, targetWorkspaceId)
      }
    }

    // Fetch projects for the workspace
    const workspaceResult = await railwayQuery<{
      workspace: {
        id: string
        name: string
        projects: { edges: Array<{ node: any }> }
      }
    }>(token, WORKSPACE_PROJECTS_QUERY, { workspaceId: targetWorkspaceId })

    if (workspaceResult.errors && workspaceResult.errors.length > 0) {
      const errorMsg = workspaceResult.errors[0].message

      // Check for permission errors
      if (errorMsg.toLowerCase().includes('not authorized') ||
          errorMsg.toLowerCase().includes('permission')) {
        return jsonResponse({
          workspace: { id: targetWorkspaceId, name: 'Unknown' },
          projects: [],
          readOnly: true,
          error: 'Read-only access to this workspace'
        }, corsHeaders)
      }

      // Workspace not found
      if (errorMsg.toLowerCase().includes('not found')) {
        return notFoundResponse(corsHeaders, 'Workspace not found. The workspace ID may be incorrect.')
      }

      return errorResponse(errorMsg, corsHeaders, 400)
    }

    if (!workspaceResult.data?.workspace) {
      return notFoundResponse(corsHeaders, 'Workspace not found')
    }

    const workspace = workspaceResult.data.workspace
    const projects = parseProjects(workspace.projects.edges)

    console.log('[railway-list-resources] Workspace:', workspace.name, 'projects:', projects.length)

    return jsonResponse({
      workspace: { id: workspace.id, name: workspace.name },
      projects,
      readOnly: false
    }, corsHeaders)

  } catch (error) {
    return handleError(error, corsHeaders)
  }
})
