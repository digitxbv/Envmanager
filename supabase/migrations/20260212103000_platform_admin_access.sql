-- =====================================================
-- Platform Admin Access
-- Migration: 20260212103000_platform_admin_access.sql
-- Description: Adds platform-level admins, helper checks, and
--              admin read/update access for organization management
-- =====================================================

-- =====================================================
-- Platform Admins Table
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE platform_admins IS
  'Platform-level administrators with cross-organization access.';

COMMENT ON COLUMN platform_admins.user_id IS
  'Auth user ID for a platform administrator.';

-- =====================================================
-- Helper: is_platform_admin
-- =====================================================

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM platform_admins
    WHERE user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

COMMENT ON FUNCTION is_platform_admin IS
  'Returns true when the authenticated user is a platform admin.';

-- =====================================================
-- RLS: platform_admins
-- =====================================================

DROP POLICY IF EXISTS "Platform admins can view admins" ON platform_admins;

CREATE POLICY "Platform admins can view admins"
  ON platform_admins FOR SELECT
  TO authenticated
  USING ((SELECT is_platform_admin()));

-- =====================================================
-- RLS: cross-org admin visibility
-- =====================================================

CREATE POLICY "Platform admins can view all organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can view all subscriptions"
  ON organization_subscriptions FOR SELECT
  TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can update subscriptions"
  ON organization_subscriptions FOR UPDATE
  TO authenticated
  USING ((SELECT is_platform_admin()))
  WITH CHECK ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can view all members"
  ON organization_members FOR SELECT
  TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can view all billing events"
  ON billing_events FOR SELECT
  TO authenticated
  USING ((SELECT is_platform_admin()));

CREATE POLICY "Platform admins can create billing events"
  ON billing_events FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT is_platform_admin()));

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
  -- Verify user has access to this organization or is a platform admin
  IF NOT (SELECT is_platform_admin()) AND NOT EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.organization_id = org_id
    AND om.user_id = auth.uid()
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

GRANT EXECUTE ON FUNCTION get_organization_members_with_emails(UUID) TO authenticated;

COMMENT ON FUNCTION get_organization_members_with_emails IS
  'Get all members of an organization with emails and environment access count. Requires org membership or platform admin access.';

-- =====================================================
-- RPC: get_platform_stats
-- =====================================================

CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT (SELECT is_platform_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT json_build_object(
    'total_organizations', (SELECT COUNT(*)::INT FROM organizations),
    'total_users', (SELECT COUNT(DISTINCT user_id)::INT FROM organization_members),
    'plan_distribution', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          plan_id,
          status,
          COUNT(*)::INT as count
        FROM organization_subscriptions
        GROUP BY plan_id, status
        ORDER BY plan_id, status
      ) t
    ), '[]'::JSON)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_platform_stats() TO authenticated;

COMMENT ON FUNCTION get_platform_stats IS
  'Returns platform-wide organization, user, and subscription distribution stats for platform admins.';

-- =====================================================
-- Seed helper (manual)
-- =====================================================
-- INSERT INTO platform_admins (user_id) VALUES ('your-user-id-here');
