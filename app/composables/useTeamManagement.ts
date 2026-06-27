// =====================================================
// Team Management Composable
// =====================================================
// Core composable for managing team members and their environment access

import type { Json, Tables } from '~/types/database.types'

export interface EnvironmentAccessEntry {
  readonly environment_id: string
  readonly access_level: 'read' | 'write'
}

export interface TeamMember {
  readonly id: string
  readonly user_id: string
  readonly email: string
  readonly role: 'owner' | 'admin' | 'member' | 'viewer'
  readonly created_at: string
  readonly environment_access: readonly EnvironmentAccessEntry[]
}

export interface Invitation {
  id: string
  email: string
  role: 'admin' | 'member' | 'viewer'
  expires_at: string
  invited_by_email: string
  created_at: string
}

export const useTeamManagement = () => {
  const client = useSupabaseClient()
  const user = useSupabaseUser()
  const { $toast } = useNuxtApp()
  const { handleError } = useSupabaseErrorHandler()
  const { checkLimit } = useLimits()

  // =====================================================
  // Reactive State
  // =====================================================

  const members = ref<TeamMember[]>([])
  const loading = ref(false)
  const invitations = ref<Invitation[]>([])
  const invitationsLoading = ref(false)

  // =====================================================
  // Authorization Helpers
  // =====================================================

  /**
   * Get the current user's role in the organization
   */
  const getCurrentUserRole = async (organizationId: string, force = false): Promise<'owner' | 'admin' | 'member' | 'viewer' | null> => {
    const userId = user.value?.id ?? user.value?.sub
    if (!userId) {
      return null
    }

    // Serve from the org store cache — the role is read 3-4x per dashboard load
    // (layout + each page). Caching it removes those redundant transatlantic
    // round-trips. Pass force=true after a role change to refresh.
    const orgStore = useOrganizationStore()
    if (!force && organizationId in orgStore.roleByOrg) {
      return orgStore.roleByOrg[organizationId] ?? null
    }

    try {
      const { data, error } = await client
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .maybeSingle()

      if (error) throw error
      const role = (data?.role ?? null) as 'owner' | 'admin' | 'member' | 'viewer' | null
      orgStore.setRole(organizationId, role)
      return role
    } catch (err) {
      console.error('[useTeamManagement] Failed to get current user role:', err)
      return null
    }
  }

  /**
   * Check if current user can manage a specific role
   * - Owners can manage everyone except themselves if they're the last owner
   * - Admins can manage members only
   * - Members cannot manage anyone
   */
  const canManageRole = (currentUserRole: 'owner' | 'admin' | 'member' | 'viewer' | null, targetRole: 'owner' | 'admin' | 'member' | 'viewer'): boolean => {
    if (!currentUserRole) return false

    const roleHierarchy = { owner: 4, admin: 3, member: 2, viewer: 1 }
    return roleHierarchy[currentUserRole] > roleHierarchy[targetRole]
  }

  /**
   * Check if a member is the last owner in the organization
   */
  const isLastOwner = async (memberId: string, organizationId: string): Promise<boolean> => {
    try {
      const { data, error } = await client
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('role', 'owner')

      if (error) throw error

      // If there's only one owner and it's this member, they're the last owner
      return data.length === 1 && data[0]?.id === memberId
    } catch (err) {
      console.error('[useTeamManagement] Failed to check if last owner:', err)
      return false
    }
  }

  // =====================================================
  // Methods
  // =====================================================

  /**
   * Fetch all members for an organization with their environment access
   */
  const fetchMembers = async (organizationId: string) => {
    if (!organizationId) {
      console.warn('[useTeamManagement] No organization ID provided')
      return
    }

    loading.value = true

    try {
      // Use RPC function to get members with emails
      const { data: membersData, error: membersError } = await client.rpc(
        'get_organization_members_with_emails',
        { org_id: organizationId }
      )

      if (membersError) throw membersError

      if (!membersData || membersData.length === 0) {
        members.value = []
        return
      }

      // Fetch detailed environment access for each member
      const enrichedMembers: TeamMember[] = await Promise.all(
        membersData.map(async (member) => {
          // Get specific environment IDs for this user
          const { data: accessData, error: accessError } = await client.rpc(
            'get_user_environment_access',
            {
              org_id: organizationId,
              target_user_id: member.user_id
            }
          )

          if (accessError) {
            console.error('[useTeamManagement] Failed to fetch environment access:', accessError)
            // Continue with empty access rather than failing
          }

          return {
            id: member.id,
            user_id: member.user_id,
            email: member.email,
            role: member.role as 'owner' | 'admin' | 'member' | 'viewer',
            created_at: member.created_at,
            environment_access: (accessData || []).map((a: { environment_id: string; access_level?: 'read' | 'write' | null }) => ({
              environment_id: a.environment_id,
              access_level: a.access_level || 'write'
            }))
          }
        })
      )

      members.value = enrichedMembers
    } catch (err) {
      console.error('[useTeamManagement] Failed to fetch members:', err)
      $toast.error('Failed to load team members')
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Invite a new member to the organization
   * For MVP: User must already exist in the system
   */
  const inviteMember = async (
    email: string,
    role: 'admin' | 'member' | 'viewer',
    organizationId: string
  ) => {
    if (!organizationId) {
      $toast.error('No organization selected')
      throw new Error('No organization ID provided')
    }

    if (!email || !email.includes('@')) {
      $toast.error('Please provide a valid email address')
      throw new Error('Invalid email address')
    }

    loading.value = true

    try {
      const { data: added, error } = await client.rpc('add_member_by_email', {
        target_email: email,
        org_id: organizationId,
        member_role: role
      })

      if (error) throw error

      if (added) {
        $toast.success('Member added successfully')
      } else {
        $toast.info('Could not add member. The user may not exist or is already a member.')
      }
      await fetchMembers(organizationId)
    } catch (err) {
      console.error('[useTeamManagement] Failed to invite member:', err)
      $toast.error('Failed to invite team member')
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update a member's role
   * Security checks:
   * - Only owners can promote to owner
   * - Admins can only manage members (not owners or other admins)
   * - Cannot downgrade the last owner
   */
  const updateMemberRole = async (
    memberId: string,
    newRole: 'owner' | 'admin' | 'member' | 'viewer',
    organizationId: string
  ) => {
    if (!memberId || !organizationId) {
      console.error('[useTeamManagement] Missing required parameters for role update')
      $toast.error('Invalid parameters')
      throw new Error('Missing required parameters')
    }

    loading.value = true

    try {
      // Get current user's role
      const currentUserRole = await getCurrentUserRole(organizationId)
      if (!currentUserRole) {
        console.error('[useTeamManagement] Current user is not a member of the organization')
        $toast.error('You do not have permission to manage this organization')
        throw new Error('Unauthorized: Not a member of this organization')
      }

      // Get target member's current role
      const { data: targetMember, error: fetchError } = await client
        .from('organization_members')
        .select('role, user_id')
        .eq('id', memberId)
        .eq('organization_id', organizationId)
        .single()

      if (fetchError) throw fetchError
      if (!targetMember) {
        console.error('[useTeamManagement] Target member not found')
        $toast.error('Member not found')
        throw new Error('Target member not found')
      }

      const targetCurrentRole = targetMember.role as 'owner' | 'admin' | 'member' | 'viewer'

      // Security check: Only owners can promote to owner
      if (newRole === 'owner' && currentUserRole !== 'owner') {
        console.warn('[useTeamManagement] Non-owner attempted to promote to owner')
        $toast.error('Only owners can promote members to owner')
        throw new Error('Unauthorized: Only owners can promote to owner')
      }

      // Security check: Admins cannot modify owners or other admins
      if (currentUserRole === 'admin' && (targetCurrentRole === 'owner' || targetCurrentRole === 'admin')) {
        console.warn('[useTeamManagement] Admin attempted to modify owner/admin role')
        $toast.error('You can only manage member roles')
        throw new Error('Unauthorized: Admins can only manage members')
      }

      // Security check: Cannot downgrade the last owner
      if (targetCurrentRole === 'owner' && newRole !== 'owner') {
        const lastOwner = await isLastOwner(memberId, organizationId)
        if (lastOwner) {
          console.warn('[useTeamManagement] Attempted to downgrade last owner')
          $toast.error('Cannot downgrade the last owner. Promote another member to owner first.')
          throw new Error('Cannot downgrade last owner')
        }
      }

      // Perform the update
      const { error: updateError } = await client
        .from('organization_members')
        .update({ role: newRole })
        .eq('id', memberId)
        .eq('organization_id', organizationId)

      if (updateError) throw updateError

      console.log(`[useTeamManagement] Successfully updated role for member ${memberId} to ${newRole}`)
      $toast.success('Member role updated successfully')
      await fetchMembers(organizationId)
    } catch (err) {
      console.error('[useTeamManagement] Failed to update member role:', err)
      // Only show generic error if we haven't already shown a specific one
      if (err instanceof Error && !err.message.includes('Unauthorized') && !err.message.includes('Cannot downgrade')) {
        $toast.error('Failed to update member role')
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Remove a member from the organization
   * Security checks:
   * - Only owners and admins can remove members
   * - Admins cannot remove owners
   * - Cannot remove the last owner
   */
  const removeMember = async (
    memberId: string,
    organizationId: string
  ) => {
    if (!memberId || !organizationId) {
      console.error('[useTeamManagement] Missing required parameters for member removal')
      $toast.error('Invalid parameters')
      throw new Error('Missing required parameters')
    }

    loading.value = true

    try {
      // Get current user's role
      const currentUserRole = await getCurrentUserRole(organizationId)
      if (!currentUserRole || (currentUserRole !== 'owner' && currentUserRole !== 'admin')) {
        console.error('[useTeamManagement] Unauthorized attempt to remove member')
        $toast.error('You do not have permission to remove members')
        throw new Error('Unauthorized: Only owners and admins can remove members')
      }

      // Get target member's current role
      const { data: targetMember, error: fetchError } = await client
        .from('organization_members')
        .select('role, user_id')
        .eq('id', memberId)
        .eq('organization_id', organizationId)
        .single()

      if (fetchError) throw fetchError
      if (!targetMember) {
        console.error('[useTeamManagement] Target member not found')
        $toast.error('Member not found')
        throw new Error('Target member not found')
      }

      const targetRole = targetMember.role as 'owner' | 'admin' | 'member' | 'viewer'

      // Security check: Admins cannot remove owners
      if (currentUserRole === 'admin' && targetRole === 'owner') {
        console.warn('[useTeamManagement] Admin attempted to remove owner')
        $toast.error('You cannot remove an owner from the organization')
        throw new Error('Unauthorized: Admins cannot remove owners')
      }

      // Security check: Cannot remove the last owner
      if (targetRole === 'owner') {
        const lastOwner = await isLastOwner(memberId, organizationId)
        if (lastOwner) {
          console.warn('[useTeamManagement] Attempted to remove last owner')
          $toast.error('Cannot remove the last owner. Promote another member to owner first.')
          throw new Error('Cannot remove last owner')
        }
      }

      // Cascade delete will handle environment_access cleanup
      const { error: deleteError } = await client
        .from('organization_members')
        .delete()
        .eq('id', memberId)
        .eq('organization_id', organizationId)

      if (deleteError) throw deleteError

      console.log(`[useTeamManagement] Successfully removed member ${memberId}`)
      $toast.success('Member removed successfully')
      await fetchMembers(organizationId)
    } catch (err) {
      console.error('[useTeamManagement] Failed to remove member:', err)
      // Only show generic error if we haven't already shown a specific one
      if (err instanceof Error && !err.message.includes('Unauthorized') && !err.message.includes('Cannot remove')) {
        $toast.error('Failed to remove member')
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Update environment access for a user
   * Replaces all existing access with the new set
   * Uses atomic database function to prevent race conditions
   */
  const updateEnvironmentAccess = async (
    userId: string,
    environmentIds: string[],
    organizationId: string,
    accessLevels?: { environment_id: string; access_level: 'read' | 'write' }[]
  ) => {
    if (!userId || !organizationId) {
      console.error('[useTeamManagement] Missing required parameters for environment access update')
      $toast.error('Invalid parameters')
      throw new Error('Missing required parameters')
    }

    const currentUserId = user.value?.id ?? user.value?.sub
    if (!currentUserId) {
      console.error('[useTeamManagement] No authenticated user')
      $toast.error('You must be logged in')
      throw new Error('No authenticated user')
    }

    loading.value = true

    try {
      // Use atomic database function to update environment access
      // This prevents race conditions from separate delete/insert operations
      const rpcParams: {
        p_user_id: string
        p_organization_id: string
        p_environment_ids: string[]
        p_granted_by: string
        p_access_levels?: Json
      } = {
        p_user_id: userId,
        p_organization_id: organizationId,
        p_environment_ids: environmentIds,
        p_granted_by: currentUserId
      }

      if (accessLevels) {
        rpcParams.p_access_levels = accessLevels as unknown as Json
      }

      const { error: rpcError } = await client.rpc('update_user_environment_access', rpcParams)

      if (rpcError) {
        // Handle specific authorization errors with user-friendly messages
        if (rpcError.message?.includes('Access denied')) {
          console.error('[useTeamManagement] Unauthorized environment access update attempt')
          $toast.error('You do not have permission to modify environment access')
          throw new Error('Unauthorized: Only owners and admins can modify environment access')
        }
        if (rpcError.message?.includes('not a member')) {
          console.error('[useTeamManagement] Target user is not a member')
          $toast.error('User is not a member of this organization')
          throw new Error('Target user is not a member')
        }
        throw rpcError
      }

      console.log(`[useTeamManagement] Successfully updated environment access for user ${userId}`)
      $toast.success('Environment access updated successfully')
      await fetchMembers(organizationId)
    } catch (err) {
      console.error('[useTeamManagement] Failed to update environment access:', err)
      // Only show generic error if we haven't already shown a specific one
      if (err instanceof Error && !err.message.includes('Unauthorized') && !err.message.includes('not a member')) {
        $toast.error('Failed to update environment access')
      }
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Fetch all pending invitations for an organization
   */
  const fetchInvitations = async (organizationId: string) => {
    if (!organizationId) {
      console.warn('[useTeamManagement] No organization ID provided for fetching invitations')
      return
    }

    invitationsLoading.value = true

    try {
      console.log(`[useTeamManagement] Fetching pending invitations for organization ${organizationId}`)

      const { data, error } = await client.rpc('get_pending_invitations', {
        p_organization_id: organizationId
      })

      if (error) throw error

      invitations.value = (data || []) as Invitation[]
      console.log(`[useTeamManagement] Successfully fetched ${invitations.value.length} pending invitations`)
    } catch (err) {
      console.error('[useTeamManagement] Failed to fetch invitations:', err)
      $toast.error('Failed to load pending invitations')
      throw err
    } finally {
      invitationsLoading.value = false
    }
  }

  /**
   * Send an invitation to a new team member
   * Checks team member limits before creating invitation
   * Sends invitation email via Edge Function
   */
  const sendInvitation = async (
    email: string,
    role: 'admin' | 'member' | 'viewer',
    organizationId: string
  ) => {
    if (!organizationId) {
      $toast.error('No organization selected')
      throw new Error('No organization ID provided')
    }

    if (!email || !email.includes('@')) {
      $toast.error('Please provide a valid email address')
      throw new Error('Invalid email address')
    }

    invitationsLoading.value = true

    try {
      console.log(`[useTeamManagement] Sending invitation to ${email} as ${role}`)

      // Check team member limit before creating invitation
      const limitResult = await checkLimit('team_members', 1)
      if (!limitResult.allowed) {
        console.warn('[useTeamManagement] Team member limit exceeded')
        const event = new CustomEvent('billing:limit-reached', { detail: limitResult })
        window.dispatchEvent(event)
        return
      }

      // Create invitation in database
      const { data: invitationData, error: invitationError } = await client.rpc('create_invitation', {
        p_organization_id: organizationId,
        p_email: email,
        p_role: role
      })

      if (invitationError) {
        // Generic message to prevent email enumeration
        if (invitationError.message?.includes('already a member') ||
            invitationError.message?.includes('pending invitation')) {
          $toast.info('If this email is valid, an invitation will be sent.')
          return
        }
        throw invitationError
      }

      console.log('[useTeamManagement] Invitation created, preparing to send email')

      // Get organization name for email
      const { data: orgData, error: orgError } = await client
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()

      if (orgError) {
        console.error('[useTeamManagement] Failed to fetch organization name:', orgError)
        throw orgError
      }

      // Get current user's email for inviter name
      const inviterEmail = user.value?.email || 'A team member'

      // Send invitation email via Edge Function
      const { error: emailError } = await client.functions.invoke('send-invitation', {
        body: {
          email,
          token: invitationData.token,
          organizationName: orgData.name,
          inviterName: inviterEmail,
          role
        }
      })

      if (emailError) {
        console.error('[useTeamManagement] Failed to send invitation email:', emailError)
        $toast.error('Invitation created but failed to send email. Please try resending.')
        await fetchInvitations(organizationId)
        return
      }

      console.log(`[useTeamManagement] Successfully sent invitation to ${email}`)
      $toast.success('If this email is valid, an invitation will be sent.', {
        description: 'Remember to grant environment access in project settings'
      })
      await fetchInvitations(organizationId)
    } catch (err) {
      console.error('[useTeamManagement] Failed to send invitation:', err)

      // Check if it's an auth error - will handle logout/redirect automatically
      const isAuthErr = await handleError(err)
      if (isAuthErr) {
        throw err
      }

      // Show generic error for non-auth errors
      $toast.error('Failed to send invitation')
      throw err
    } finally {
      invitationsLoading.value = false
    }
  }

  /**
   * Cancel a pending invitation
   */
  const cancelInvitation = async (invitationId: string, organizationId: string) => {
    if (!invitationId || !organizationId) {
      console.error('[useTeamManagement] Missing required parameters for canceling invitation')
      $toast.error('Invalid parameters')
      throw new Error('Missing required parameters')
    }

    invitationsLoading.value = true

    try {
      console.log(`[useTeamManagement] Canceling invitation ${invitationId}`)

      const { error } = await client.rpc('cancel_invitation', {
        p_invitation_id: invitationId
      })

      if (error) throw error

      console.log(`[useTeamManagement] Successfully canceled invitation ${invitationId}`)
      $toast.success('Invitation canceled')
      await fetchInvitations(organizationId)
    } catch (err) {
      console.error('[useTeamManagement] Failed to cancel invitation:', err)
      $toast.error('Failed to cancel invitation')
      throw err
    } finally {
      invitationsLoading.value = false
    }
  }

  /**
   * Resend an invitation email
   * Generates a new token and sends a new email
   */
  const resendInvitation = async (invitationId: string, organizationId: string) => {
    if (!invitationId || !organizationId) {
      console.error('[useTeamManagement] Missing required parameters for resending invitation')
      $toast.error('Invalid parameters')
      throw new Error('Missing required parameters')
    }

    invitationsLoading.value = true

    try {
      console.log(`[useTeamManagement] Resending invitation ${invitationId}`)

      // Generate new token via RPC
      const { data: tokenData, error: tokenError } = await client.rpc('resend_invitation', {
        p_invitation_id: invitationId
      })

      if (tokenError) throw tokenError

      if (!tokenData || !tokenData.token) {
        console.error('[useTeamManagement] No token returned from resend_invitation')
        throw new Error('Failed to generate new invitation token')
      }

      console.log('[useTeamManagement] New token generated, preparing to send email')

      // Get organization name for email
      const { data: orgData, error: orgError } = await client
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single()

      if (orgError) {
        console.error('[useTeamManagement] Failed to fetch organization name:', orgError)
        throw orgError
      }

      // Get current user's email for inviter name
      const inviterEmail = user.value?.email || 'A team member'

      // Send invitation email via Edge Function
      const { error: emailError } = await client.functions.invoke('send-invitation', {
        body: {
          email: tokenData.email,
          token: tokenData.token,
          organizationName: orgData.name,
          inviterName: inviterEmail,
          role: tokenData.role
        }
      })

      if (emailError) {
        console.error('[useTeamManagement] Failed to send invitation email:', emailError)
        $toast.error('Failed to send invitation email. Please try again.')
        return
      }

      console.log(`[useTeamManagement] Successfully resent invitation to ${tokenData.email}`)
      $toast.success('Invitation resent successfully')
      await fetchInvitations(organizationId)
    } catch (err) {
      console.error('[useTeamManagement] Failed to resend invitation:', err)
      $toast.error('Failed to resend invitation')
      throw err
    } finally {
      invitationsLoading.value = false
    }
  }

  // =====================================================
  // Return Public API
  // =====================================================

  return {
    members: readonly(members),
    loading: readonly(loading),
    getCurrentUserRole,
    fetchMembers,
    inviteMember,
    updateMemberRole,
    removeMember,
    updateEnvironmentAccess,
    invitations: readonly(invitations),
    invitationsLoading: readonly(invitationsLoading),
    fetchInvitations,
    sendInvitation,
    cancelInvitation,
    resendInvitation
  }
}
