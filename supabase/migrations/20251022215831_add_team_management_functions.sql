-- =====================================================
-- Team Management Functions
-- =====================================================
-- Functions to support team member management with email access

-- =====================================================
-- Function: Get user ID by email
-- =====================================================
-- Allows looking up a user's ID by their email address
-- Used for inviting existing users to organizations

CREATE OR REPLACE FUNCTION get_user_by_email(user_email TEXT)
RETURNS TABLE (
  id UUID,
  email TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id,
    au.email::TEXT,
    au.created_at
  FROM auth.users au
  WHERE au.email = user_email
  LIMIT 1;
END;
$$;

-- =====================================================
-- Function: Get organization members with emails
-- =====================================================
-- Fetches all members of an organization with their email addresses
-- and environment access counts

CREATE OR REPLACE FUNCTION get_organization_members_with_emails(org_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  role TEXT,
  created_at TIMESTAMPTZ,
  environment_access_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to this organization
  IF NOT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to organization';
  END IF;

  RETURN QUERY
  SELECT
    om.id,
    om.user_id,
    COALESCE(au.email, 'unknown@example.com')::TEXT as email,
    om.role,
    om.created_at,
    COUNT(DISTINCT ea.environment_id) as environment_access_count
  FROM organization_members om
  LEFT JOIN auth.users au ON au.id = om.user_id
  LEFT JOIN environment_access ea ON ea.user_id = om.user_id
    AND ea.organization_id = org_id
  WHERE om.organization_id = org_id
  GROUP BY om.id, om.user_id, au.email, om.role, om.created_at
  ORDER BY om.created_at ASC;
END;
$$;

-- =====================================================
-- Function: Get environment access for a user
-- =====================================================
-- Fetches all environment IDs a user has access to in an organization

CREATE OR REPLACE FUNCTION get_user_environment_access(
  org_id UUID,
  target_user_id UUID
)
RETURNS TABLE (
  environment_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify requesting user has access to this organization
  IF NOT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to organization';
  END IF;

  RETURN QUERY
  SELECT ea.environment_id
  FROM environment_access ea
  WHERE ea.organization_id = org_id
  AND ea.user_id = target_user_id
  ORDER BY ea.created_at ASC;
END;
$$;

-- =====================================================
-- Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION get_user_by_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_members_with_emails(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_environment_access(UUID, UUID) TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON FUNCTION get_user_by_email IS
  'Look up a user by email address. Used for inviting existing users to organizations.';

COMMENT ON FUNCTION get_organization_members_with_emails IS
  'Get all members of an organization with their email addresses and environment access counts. Requires organization membership.';

COMMENT ON FUNCTION get_user_environment_access IS
  'Get all environment IDs a user has access to in an organization. Requires organization membership.';
