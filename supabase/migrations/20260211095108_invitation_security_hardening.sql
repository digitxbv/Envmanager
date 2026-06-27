-- =====================================================
-- Invitation Security Hardening (SEC-003)
-- Remove token from get_pending_invitations response
-- to prevent token exposure to all org members
-- =====================================================

-- Must DROP first because return type is changing (token column removed)
DROP FUNCTION IF EXISTS get_pending_invitations(UUID);

CREATE OR REPLACE FUNCTION get_pending_invitations(
    p_organization_id UUID
)
RETURNS TABLE (
    id UUID,
    email TEXT,
    role TEXT,
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
