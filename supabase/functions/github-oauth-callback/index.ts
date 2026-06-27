// =====================================================
// GitHub OAuth Callback Edge Function
// =====================================================
// Handles the OAuth callback after a user installs the GitHub App.
// Exchanges the installation code for installation data and stores it.
//
// Flow:
// 1. User clicks "Connect GitHub" -> redirected to GitHub
// 2. User installs app -> GitHub redirects here with code + installation_id
// 3. We fetch installation details and store in github_installations
// 4. Redirect user back to EnvManager settings
//
// Deploy with: supabase functions deploy github-oauth-callback --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createGitHubAppJWT } from '../_shared/github-jwt.js'
import { logError } from '../_shared/logger.js'

// =====================================================
// Types
// =====================================================

interface GitHubInstallation {
  id: number
  account: {
    login: string
    id: number
    type: 'User' | 'Organization'
  }
  repository_selection: 'all' | 'selected'
  permissions: Record<string, string>
  suspended_at: string | null
}

// =====================================================
// GitHub API Helpers
// =====================================================

async function getInstallation(installationId: string, appJwt: string): Promise<GitHubInstallation> {
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        'Authorization': `Bearer ${appJwt}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  )
  
  if (!response.ok) {
    const error = await response.text()
    console.error('[github-oauth-callback] Failed to get installation:', error)
    throw new Error(`Failed to get installation: ${response.status}`)
  }
  
  return await response.json()
}

// =====================================================
// Main Handler
// =====================================================

serve(async (req) => {
  const url = new URL(req.url)
  
  // GitHub sends: ?code=xxx&installation_id=xxx&setup_action=install
  const code = url.searchParams.get('code')
  const installationId = url.searchParams.get('installation_id')
  const setupAction = url.searchParams.get('setup_action')
  
  // State contains: organizationId:returnUrl (base64 encoded)
  const state = url.searchParams.get('state')
  
  // App URL for redirects
  const appUrl = Deno.env.get('APP_URL') || 'http://localhost:4400'
  
  // Error redirect helper
  const errorRedirect = (message: string) => {
    const errorUrl = new URL(`${appUrl}/dashboard/settings`)
    errorUrl.searchParams.set('tab', 'integrations')
    errorUrl.searchParams.set('error', message)
    return Response.redirect(errorUrl.toString(), 302)
  }
  
  try {
    // Validate required parameters
    if (!installationId) {
      console.error('[github-oauth-callback] Missing installation_id')
      return errorRedirect('Missing installation ID')
    }
    
    if (!state) {
      console.error('[github-oauth-callback] Missing state parameter')
      return errorRedirect('Invalid request - missing state')
    }
    
    // Decode state
    let organizationId: string
    let userId: string
    try {
      const decodedState = atob(state)
      const [orgId, uid] = decodedState.split(':')
      organizationId = orgId
      userId = uid
    } catch {
      console.error('[github-oauth-callback] Invalid state parameter')
      return errorRedirect('Invalid request state')
    }
    
    // Get GitHub App credentials
    const appId = Deno.env.get('GITHUB_APP_ID')
    const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY')
    
    if (!appId || !privateKey) {
      console.error('[github-oauth-callback] Missing GitHub App configuration')
      return errorRedirect('GitHub integration not configured')
    }
    
    // Create JWT for GitHub App authentication
    const appJwt = await createGitHubAppJWT(appId, privateKey)
    
    // Get installation details from GitHub
    const installation = await getInstallation(installationId, appJwt)
    
    console.log('[github-oauth-callback] Installation received:', {
      id: installation.id,
      account: installation.account.login,
      type: installation.account.type
    })
    
    // Create Supabase client with service role (to bypass RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    // Verify organization exists and user is owner/admin
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single()
    
    if (membershipError || !membership || !['owner', 'admin'].includes(membership.role)) {
      console.error('[github-oauth-callback] User not authorized:', membershipError)
      return errorRedirect('Not authorized to manage integrations')
    }
    
    // Check if installation already exists (might be re-installing)
    const { data: existingInstallation } = await supabase
      .from('github_installations')
      .select('id, installation_id')
      .eq('organization_id', organizationId)
      .eq('installation_id', installation.id)
      .single()

    if (existingInstallation) {
      // Update existing installation (might have been suspended/uninstalled)
      const { error: updateError } = await supabase
        .from('github_installations')
        .update({
          account_type: installation.account.type,
          account_login: installation.account.login,
          account_id: installation.account.id,
          permissions: installation.permissions,
          repository_selection: installation.repository_selection,
          suspended_at: installation.suspended_at,
          uninstalled_at: null, // Clear uninstall flag
          updated_at: new Date().toISOString()
        })
        .eq('id', existingInstallation.id)

      if (updateError) {
        console.error('[github-oauth-callback] Failed to update installation:', updateError)
        return errorRedirect('Failed to update GitHub connection')
      }

      console.log('[github-oauth-callback] Updated existing installation')
    } else {
      // Insert new installation
      const { error: insertError } = await supabase
        .from('github_installations')
        .insert({
          organization_id: organizationId,
          installation_id: installation.id,
          account_type: installation.account.type,
          account_login: installation.account.login,
          account_id: installation.account.id,
          permissions: installation.permissions,
          repository_selection: installation.repository_selection,
          installed_by: userId,
          suspended_at: installation.suspended_at
        })

      if (insertError) {
        console.error('[github-oauth-callback] Failed to store installation:', insertError)
        return errorRedirect('Failed to save GitHub connection')
      }

      console.log('[github-oauth-callback] Stored new installation')
    }
    
    // Success - redirect back to settings with success message
    const successUrl = new URL(`${appUrl}/dashboard/settings`)
    successUrl.searchParams.set('tab', 'integrations')
    successUrl.searchParams.set('github', 'connected')
    
    return Response.redirect(successUrl.toString(), 302)
    
  } catch (error) {
    logError(error, { functionName: 'github-oauth-callback' })
    return errorRedirect('An unexpected error occurred')
  }
})
