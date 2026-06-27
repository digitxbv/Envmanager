import { createClient } from '@supabase/supabase-js'

/**
 * Billing Helper for E2E Tests
 * Uses service role key to directly manipulate subscription plans
 */

const getServiceClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54431'
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY environment variable is required for billing tests')
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export type PlanId = 'free' | 'pro_monthly' | 'pro_annual'

/**
 * Set subscription plan for an organization
 * For free plan: sets status to 'active' and clears trial dates to disable Pro features
 * For pro plans: sets status to 'trialing' with active trial dates
 */
export async function setSubscriptionPlan(
  organizationId: string,
  planId: PlanId
): Promise<void> {
  const client = getServiceClient()
  
  const updateData: Record<string, unknown> = {
    plan_id: planId,
    updated_at: new Date().toISOString()
  }
  
  if (planId === 'free') {
    // End trial to enforce free plan limits
    updateData.status = 'active'
    updateData.trial_start_date = null
    updateData.trial_end_date = null
  } else {
    // Pro plan with active trial
    updateData.status = 'trialing'
    updateData.trial_start_date = new Date().toISOString()
    updateData.trial_end_date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  }
  
  const { data, error, status, statusText } = await client
    .from('organization_subscriptions')
    .update(updateData)
    .eq('organization_id', organizationId)
    .select()
  
  if (error && Object.keys(error).length > 0) {
    throw new Error(`Failed to set subscription plan: ${JSON.stringify(error)} (status: ${status} ${statusText})`)
  }
  
  if (!data || data.length === 0) {
    throw new Error(`No subscription found for organization ${organizationId}. Make sure seed data exists.`)
  }
}

/**
 * Get current subscription for an organization
 */
export async function getSubscription(organizationId: string) {
  const client = getServiceClient()
  
  const { data, error } = await client
    .from('organization_subscriptions')
    .select(`
      *,
      plan:subscription_plans(*)
    `)
    .eq('organization_id', organizationId)
    .single()
  
  if (error) {
    throw new Error(`Failed to get subscription: ${error.message}`)
  }
  
  return data
}

/**
 * Reset organization to free plan
 */
export async function resetToFreePlan(organizationId: string): Promise<void> {
  await setSubscriptionPlan(organizationId, 'free')
}

/**
 * Upgrade organization to Pro plan
 */
export async function upgradeToProPlan(organizationId: string): Promise<void> {
  await setSubscriptionPlan(organizationId, 'pro_monthly')
}

export async function upgradeProjectOrganizationToPro(projectId: string): Promise<void> {
  const client = getServiceClient()

  const { data, error } = await client
    .from('projects')
    .select('organization_id')
    .eq('id', projectId)
    .single()

  if (error || !data?.organization_id) {
    throw new Error(`Failed to resolve organization for project ${projectId}`)
  }

  await upgradeToProPlan(data.organization_id)
}

/**
 * Get resource counts for limit testing
 */
export async function getResourceCounts(organizationId: string) {
  const client = getServiceClient()
  
  const [projects, environments, members] = await Promise.all([
    client.from('projects').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    client.from('environments').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId),
    client.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
  ])
  
  return {
    projects: projects.count || 0,
    environments: environments.count || 0,
    members: members.count || 0
  }
}
