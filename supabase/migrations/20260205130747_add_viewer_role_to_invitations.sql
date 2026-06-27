-- Add 'viewer' role support to invitation system
-- The granular access control feature added viewer role but invitations weren't updated

-- Update the CHECK constraint on organization_invitations to allow 'viewer'
ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_role_check;
ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_role_check CHECK (role IN ('admin', 'member', 'viewer'));

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

    -- Allow admin, member, or viewer roles
    IF p_role NOT IN ('admin', 'member', 'viewer') THEN
        RAISE EXCEPTION 'Role must be admin, member, or viewer';
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
