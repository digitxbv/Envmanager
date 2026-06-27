import { SupabaseClient } from '@supabase/supabase-js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Strip optional '#' prefix and return the cleaned input.
 */
function cleanProjectInput(input: string): string {
  return input.startsWith('#') ? input.slice(1) : input
}

/**
 * Resolve a project identifier (UUID, friendly ID, or name) to a UUID.
 * @param input - UUID, "#N" friendly ID, numeric friendly ID, or project name
 * @param client - Supabase client
 * @param organizationId - Organization context (required for friendly ID/name lookup)
 */
export async function resolveProjectId(
  input: string,
  client: SupabaseClient,
  organizationId: string
): Promise<string> {
  const cleaned = cleanProjectInput(input)

  // If UUID, return directly
  if (UUID_REGEX.test(cleaned)) {
    return cleaned
  }

  // If numeric, treat as friendly_id
  if (/^\d+$/.test(cleaned)) {
    const friendlyId = parseInt(cleaned, 10)
    if (friendlyId < 1) {
      throw new Error('Project ID must be 1 or greater')
    }

    const { data, error } = await client
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('friendly_id', friendlyId)
      .single()

    if (error || !data) {
      throw new Error(`Project with ID ${friendlyId} not found in this organization`)
    }
    return data.id
  }

  // Otherwise treat as name (case-insensitive)
  const { data, error } = await client
    .from('projects')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', cleaned)
    .single()

  if (error || !data) {
    throw new Error(`Project "${input}" not found in this organization`)
  }
  return data.id
}

/**
 * Resolve an environment identifier to a UUID.
 */
export async function resolveEnvironmentId(
  input: string,
  client: SupabaseClient,
  projectId: string
): Promise<string> {
  // If UUID, return directly
  if (UUID_REGEX.test(input)) {
    return input
  }

  // If numeric, treat as friendly_id
  if (/^\d+$/.test(input)) {
    const friendlyId = parseInt(input, 10)
    if (friendlyId < 1) {
      throw new Error('Environment ID must be 1 or greater')
    }

    const { data, error } = await client
      .from('environments')
      .select('id')
      .eq('project_id', projectId)
      .eq('friendly_id', friendlyId)
      .single()

    if (error || !data) {
      throw new Error(`Environment with ID ${friendlyId} not found in this project`)
    }
    return data.id
  }

  // Otherwise treat as name
  const { data, error } = await client
    .from('environments')
    .select('id')
    .eq('project_id', projectId)
    .ilike('name', input)
    .single()

  if (error || !data) {
    throw new Error(`Environment "${input}" not found in this project`)
  }
  return data.id
}

/**
 * Resolve organization context. Auto-selects for single-org users.
 * When multiple orgs exist and a project hint is provided, tries to
 * auto-detect the org by searching for the project across all orgs.
 * @param input - Organization name (optional for single-org users)
 * @param client - Supabase client
 * @param projectHint - Optional project identifier to auto-detect org from
 */
export async function resolveOrganizationId(
  input: string | undefined,
  client: SupabaseClient,
  projectHint?: string
): Promise<string> {
  // Get current user ID to scope query (platform admins bypass RLS otherwise)
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch only this user's organizations
  const { data: memberships, error: memberError } = await client
    .from('organization_members')
    .select('organization_id, organizations(id, name)')
    .eq('user_id', user.id)

  if (memberError || !memberships || memberships.length === 0) {
    throw new Error('No organizations found. Create one at envmanager.dev')
  }

  // Single org: auto-select if no input
  if (memberships.length === 1 && !input) {
    return memberships[0].organization_id
  }

  // Explicit --org provided: find by name
  if (input) {
    const match = memberships.find(m => {
      const org = (m.organizations as unknown) as { name: string } | null
      return org?.name?.toLowerCase() === input.toLowerCase()
    })

    if (!match) {
      throw new Error(`Organization "${input}" not found or you don't have access`)
    }

    return match.organization_id
  }

  // Multiple orgs, no --org: try to auto-detect from project
  if (projectHint) {
    const orgId = await detectOrgFromProject(projectHint, client, memberships)
    if (orgId) return orgId
  }

  // Fallback: list orgs for user
  const orgList = memberships
    .map(m => {
      const org = (m.organizations as unknown) as { name: string } | null
      return org?.name || 'Unknown'
    })
    .join(', ')
  throw new Error(`Multiple organizations found. Use --org to specify: ${orgList}`)
}

/**
 * Try to find which org a project belongs to by searching across all user's orgs.
 * Returns the org ID if found in exactly one org, null otherwise.
 */
async function detectOrgFromProject(
  projectInput: string,
  client: SupabaseClient,
  memberships: { organization_id: string }[]
): Promise<string | null> {
  const cleaned = cleanProjectInput(projectInput)
  const orgIds = memberships.map(m => m.organization_id)

  // UUID: direct lookup
  if (UUID_REGEX.test(cleaned)) {
    const { data } = await client
      .from('projects')
      .select('organization_id')
      .eq('id', cleaned)
      .in('organization_id', orgIds)
      .single()
    return data?.organization_id ?? null
  }

  // Friendly ID (numeric)
  if (/^\d+$/.test(cleaned)) {
    const friendlyId = parseInt(cleaned, 10)
    const { data } = await client
      .from('projects')
      .select('organization_id')
      .in('organization_id', orgIds)
      .eq('friendly_id', friendlyId)

    if (data && data.length === 1) return data[0].organization_id
    return null // ambiguous or not found
  }

  // Name (case-insensitive)
  const { data } = await client
    .from('projects')
    .select('organization_id')
    .in('organization_id', orgIds)
    .ilike('name', cleaned)

  if (data && data.length === 1) return data[0].organization_id
  return null // ambiguous or not found
}

/**
 * Resolve a service name to its UUID within a project.
 */
export async function resolveServiceId(
  serviceName: string,
  client: SupabaseClient,
  projectId: string
): Promise<string> {
  const { data, error } = await client
    .from('services')
    .select('id')
    .eq('project_id', projectId)
    .ilike('name', serviceName)
    .single()

  if (error || !data) {
    // List available services for helpful error
    const { data: allServices } = await client
      .from('services')
      .select('name')
      .eq('project_id', projectId)
      .order('sort_order')

    const available = allServices?.map(s => s.name).join(', ') || 'none'
    throw new Error(`Service "${serviceName}" not found in project. Available services: ${available}`)
  }

  return data.id
}
