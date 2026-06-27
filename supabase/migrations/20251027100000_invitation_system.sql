-- =====================================================
-- INVITATION SYSTEM
-- Migration: 20251027100000_invitation_system.sql
-- Description: Email invitation system for organization collaboration
-- =====================================================

-- =====================================================
-- Organization Invitations Table
-- =====================================================

CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Invitation Details
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

    -- Status Tracking
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'canceled')),

    -- Lifecycle Timestamps
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 day'),
    accepted_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,

    -- Audit Trail
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Indexes
-- =====================================================

-- Prevent duplicate pending invitations for same email in same org
CREATE UNIQUE INDEX idx_unique_pending_invitations
    ON organization_invitations(organization_id, email)
    WHERE status = 'pending';

CREATE INDEX idx_invitations_organization_id ON organization_invitations(organization_id);
CREATE INDEX idx_invitations_email ON organization_invitations(email);
CREATE INDEX idx_invitations_token ON organization_invitations(token);
CREATE INDEX idx_invitations_status ON organization_invitations(status);
CREATE INDEX idx_invitations_expires_at ON organization_invitations(expires_at) WHERE status = 'pending';

-- =====================================================
-- Triggers
-- =====================================================

CREATE TRIGGER update_organization_invitations_updated_at
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- Organization members can view invitations for their org
CREATE POLICY "Organization members can view invitations"
    ON organization_invitations FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

-- Only owners and admins can create invitations (enforced in RPC)
-- No direct INSERT policy - must use create_invitation() RPC

-- Only owners and admins can cancel invitations (enforced in RPC)
-- No direct UPDATE/DELETE policy - must use cancel_invitation() RPC

-- =====================================================
-- RPC Function: Create Invitation
-- =====================================================

CREATE OR REPLACE FUNCTION create_invitation(
    p_organization_id UUID,
    p_email TEXT,
    p_role TEXT
)
RETURNS organization_invitations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation organization_invitations;
    v_user_role TEXT;
    v_existing_member UUID;
    v_existing_pending UUID;
BEGIN
    -- Validate inputs
    IF p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'Email is required';
    END IF;

    IF p_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format';
    END IF;

    IF p_role NOT IN ('admin', 'member') THEN
        RAISE EXCEPTION 'Role must be admin or member';
    END IF;

    -- Check if caller is owner or admin
    SELECT role INTO v_user_role
    FROM organization_members
    WHERE organization_id = p_organization_id
    AND user_id = auth.uid()
    LIMIT 1;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'You are not a member of this organization';
    END IF;

    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Only owners and admins can invite members';
    END IF;

    -- Check if user is already a member
    SELECT user_id INTO v_existing_member
    FROM organization_members om
    INNER JOIN auth.users u ON om.user_id = u.id
    WHERE om.organization_id = p_organization_id
    AND u.email = p_email
    LIMIT 1;

    IF v_existing_member IS NOT NULL THEN
        RAISE EXCEPTION 'User is already a member of this organization';
    END IF;

    -- Check for existing pending invitation
    SELECT id INTO v_existing_pending
    FROM organization_invitations
    WHERE organization_id = p_organization_id
    AND email = p_email
    AND status = 'pending'
    AND expires_at > NOW()
    LIMIT 1;

    IF v_existing_pending IS NOT NULL THEN
        RAISE EXCEPTION 'An active invitation already exists for this email';
    END IF;

    -- Create invitation
    INSERT INTO organization_invitations (
        organization_id,
        email,
        role,
        invited_by
    )
    VALUES (
        p_organization_id,
        p_email,
        p_role,
        auth.uid()
    )
    RETURNING * INTO v_invitation;

    RETURN v_invitation;
END;
$$;

-- =====================================================
-- RPC Function: Accept Invitation
-- =====================================================

CREATE OR REPLACE FUNCTION accept_invitation(
    p_token UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation organization_invitations;
    v_user_id UUID;
    v_existing_member UUID;
    v_result JSONB;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be logged in to accept an invitation';
    END IF;

    -- Lock and fetch invitation
    SELECT * INTO v_invitation
    FROM organization_invitations
    WHERE token = p_token
    FOR UPDATE;

    -- Validate invitation exists
    IF v_invitation IS NULL THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;

    -- Check if already accepted
    IF v_invitation.status = 'accepted' THEN
        RAISE EXCEPTION 'This invitation has already been accepted';
    END IF;

    -- Check if canceled
    IF v_invitation.status = 'canceled' THEN
        RAISE EXCEPTION 'This invitation has been canceled';
    END IF;

    -- Check if expired
    IF v_invitation.status = 'expired' OR v_invitation.expires_at < NOW() THEN
        -- Auto-mark as expired
        UPDATE organization_invitations
        SET status = 'expired', updated_at = NOW()
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'This invitation has expired';
    END IF;

    -- Check if user's email matches invitation
    IF NOT EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = v_user_id
        AND email = v_invitation.email
    ) THEN
        RAISE EXCEPTION 'This invitation is for a different email address';
    END IF;

    -- Check if already a member
    SELECT user_id INTO v_existing_member
    FROM organization_members
    WHERE organization_id = v_invitation.organization_id
    AND user_id = v_user_id;

    IF v_existing_member IS NOT NULL THEN
        -- Mark as accepted but don't duplicate membership
        UPDATE organization_invitations
        SET
            status = 'accepted',
            accepted_at = NOW(),
            accepted_by = v_user_id,
            updated_at = NOW()
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'You are already a member of this organization';
    END IF;

    -- Add user to organization
    INSERT INTO organization_members (
        organization_id,
        user_id,
        role
    )
    VALUES (
        v_invitation.organization_id,
        v_user_id,
        v_invitation.role
    );

    -- Mark invitation as accepted
    UPDATE organization_invitations
    SET
        status = 'accepted',
        accepted_at = NOW(),
        accepted_by = v_user_id,
        updated_at = NOW()
    WHERE id = v_invitation.id;

    -- Return success with organization details
    SELECT jsonb_build_object(
        'success', true,
        'organization_id', o.id,
        'organization_name', o.name,
        'role', v_invitation.role
    ) INTO v_result
    FROM organizations o
    WHERE o.id = v_invitation.organization_id;

    RETURN v_result;
END;
$$;

-- =====================================================
-- RPC Function: Cancel Invitation
-- =====================================================

CREATE OR REPLACE FUNCTION cancel_invitation(
    p_invitation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation organization_invitations;
    v_user_role TEXT;
BEGIN
    -- Lock and fetch invitation
    SELECT * INTO v_invitation
    FROM organization_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;

    IF v_invitation IS NULL THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;

    -- Check if caller is owner or admin
    SELECT role INTO v_user_role
    FROM organization_members
    WHERE organization_id = v_invitation.organization_id
    AND user_id = auth.uid()
    LIMIT 1;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'You are not a member of this organization';
    END IF;

    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Only owners and admins can cancel invitations';
    END IF;

    -- Check if already accepted or canceled
    IF v_invitation.status IN ('accepted', 'canceled') THEN
        RAISE EXCEPTION 'Cannot cancel an invitation that is already % ', v_invitation.status;
    END IF;

    -- Cancel invitation
    UPDATE organization_invitations
    SET
        status = 'canceled',
        canceled_at = NOW(),
        updated_at = NOW()
    WHERE id = p_invitation_id;

    RETURN TRUE;
END;
$$;

-- =====================================================
-- RPC Function: Resend Invitation
-- =====================================================

CREATE OR REPLACE FUNCTION resend_invitation(
    p_invitation_id UUID
)
RETURNS organization_invitations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation organization_invitations;
    v_user_role TEXT;
BEGIN
    -- Lock and fetch invitation
    SELECT * INTO v_invitation
    FROM organization_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;

    IF v_invitation IS NULL THEN
        RAISE EXCEPTION 'Invitation not found';
    END IF;

    -- Check if caller is owner or admin
    SELECT role INTO v_user_role
    FROM organization_members
    WHERE organization_id = v_invitation.organization_id
    AND user_id = auth.uid()
    LIMIT 1;

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'You are not a member of this organization';
    END IF;

    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Only owners and admins can resend invitations';
    END IF;

    -- Check if invitation can be resent
    IF v_invitation.status NOT IN ('pending', 'expired') THEN
        RAISE EXCEPTION 'Can only resend pending or expired invitations';
    END IF;

    -- Update invitation with new token and expiry
    UPDATE organization_invitations
    SET
        status = 'pending',
        token = gen_random_uuid(),
        expires_at = NOW() + INTERVAL '1 day',
        updated_at = NOW()
    WHERE id = p_invitation_id
    RETURNING * INTO v_invitation;

    RETURN v_invitation;
END;
$$;

-- =====================================================
-- Helper Function: Get Pending Invitations
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_invitations(
    p_organization_id UUID
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role TEXT,
    token UUID,
    expires_at TIMESTAMPTZ,
    invited_by_email TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    -- Check if caller is member of organization
    IF NOT EXISTS (
        SELECT 1
        FROM organization_members
        WHERE organization_id = p_organization_id
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'You are not a member of this organization';
    END IF;

    RETURN QUERY
    SELECT
        i.id,
        i.email,
        i.role,
        i.token,
        i.expires_at,
        u.email AS invited_by_email,
        i.created_at
    FROM organization_invitations i
    JOIN auth.users u ON i.invited_by = u.id
    WHERE i.organization_id = p_organization_id
    AND i.status = 'pending'
    AND i.expires_at > NOW()
    ORDER BY i.created_at DESC;
END;
$$;

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION create_invitation(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION resend_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_invitations(UUID) TO authenticated;

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE organization_invitations IS 'Email-based invitation system for organization collaboration';
COMMENT ON COLUMN organization_invitations.token IS 'UUID token used in invitation URL';
COMMENT ON COLUMN organization_invitations.expires_at IS 'Invitation expires after 1 day';
COMMENT ON FUNCTION create_invitation IS 'Create new invitation and enforce business rules (limit checks done in application)';
COMMENT ON FUNCTION accept_invitation IS 'Accept invitation and add user to organization atomically';
COMMENT ON FUNCTION cancel_invitation IS 'Cancel pending invitation (owners/admins only)';
COMMENT ON FUNCTION resend_invitation IS 'Generate new token and extend expiry for pending/expired invitations';
