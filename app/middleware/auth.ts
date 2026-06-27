export default defineNuxtRouteMiddleware(async (to, from) => {
  const client = useSupabaseClient()

  // Use getUser() to securely verify the user with the server
  const { data: { user }, error: userError } = await client.auth.getUser()
  const userId = user?.id

  // If authenticated user exists
  if (userId) {
    // Check if authenticated user needs onboarding (no organization)
    if (!to.path.startsWith('/onboarding') && !to.path.startsWith('/auth/')) {
      let hasOrganizationMembership = false
      let membershipLookupError: Error | null = null

      for (let attempt = 0; attempt < 3; attempt++) {
        const { data: orgMemberships, error } = await client
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', userId)
          .limit(1)

        if (error) {
          membershipLookupError = error
          break
        }

        if (orgMemberships && orgMemberships.length > 0) {
          hasOrganizationMembership = true
          break
        }

        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }

      if (membershipLookupError) {
        console.warn('[auth middleware] Failed to verify organization membership:', membershipLookupError)
      } else if (!hasOrganizationMembership) {
        if (to.path.startsWith('/admin')) {
          const { data: platformAdminMembership, error: platformAdminError } = await client
            .from('platform_admins')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle()

          if (platformAdminError) {
            console.warn('[auth middleware] Failed to verify platform admin access:', platformAdminError)
          }

          if (platformAdminMembership) {
            return
          }
        }

        return navigateTo('/onboarding')
      }
    }

    // Check MFA requirement (skip for /auth/mfa and /auth/callback to avoid loops)
    if (to.path !== '/auth/mfa' && to.path !== '/auth/callback') {
      const { data: aal } = await client.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel === 'aal1') {
        // Check if user bypassed MFA via recovery code (server-side session)
        const { data: hasRecoveryBypass } = await client.rpc('check_mfa_recovery_bypass')
        if (hasRecoveryBypass === true) {
          return
        }
        return navigateTo('/auth/mfa')
      }
    }
  }

  // Redirect unauthenticated users away from protected routes
  if (!userId && !to.path.startsWith('/auth/')) {
    return navigateTo('/auth/login')
  }

  // Redirect authenticated users away from auth pages (except callback and mfa)
  if (userId && to.path.startsWith('/auth/') && to.path !== '/auth/callback' && to.path !== '/auth/mfa') {
    return navigateTo('/dashboard')
  }
})
