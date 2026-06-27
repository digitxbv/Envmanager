-- =====================================================
-- Onboarding Function
-- =====================================================
-- This function handles the initial organization creation
-- and owner membership in a single atomic operation,
-- bypassing RLS to solve the bootstrapping problem.

CREATE OR REPLACE FUNCTION create_organization_with_owner(
    org_name TEXT
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id UUID;
    calling_user_id UUID;
BEGIN
    -- Get the calling user's ID
    calling_user_id := auth.uid();

    -- Ensure user is authenticated
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Create the organization
    INSERT INTO organizations (name)
    VALUES (org_name)
    RETURNING organizations.id INTO new_org_id;

    -- Add the user as the owner
    INSERT INTO organization_members (organization_id, user_id, role)
    VALUES (new_org_id, calling_user_id, 'owner');

    -- Return the organization
    RETURN QUERY
    SELECT o.id, o.name, o.created_at, o.updated_at
    FROM organizations o
    WHERE o.id = new_org_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organization_with_owner(TEXT) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION create_organization_with_owner IS
'Creates a new organization and automatically adds the calling user as the owner. Used during onboarding to bypass RLS bootstrapping issues.';
