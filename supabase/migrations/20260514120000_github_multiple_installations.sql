-- =====================================================
-- GITHUB MULTIPLE INSTALLATIONS
-- Migration: 20260514120000_github_multiple_installations.sql
-- Description: Allow one EnvManager organization to connect multiple GitHub App installations.
-- =====================================================

CREATE OR REPLACE FUNCTION get_github_installations(p_organization_id UUID)
RETURNS SETOF github_installations
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT *
    FROM github_installations
    WHERE organization_id = p_organization_id
      AND organization_id IN (SELECT get_user_organization_ids())
      AND uninstalled_at IS NULL
      AND suspended_at IS NULL
    ORDER BY
      CASE account_type WHEN 'Organization' THEN 0 ELSE 1 END,
      lower(account_login),
      installed_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_github_installation(p_organization_id UUID)
RETURNS github_installations
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT *
    FROM github_installations
    WHERE organization_id = p_organization_id
      AND organization_id IN (SELECT get_user_organization_ids())
      AND uninstalled_at IS NULL
      AND suspended_at IS NULL
    ORDER BY installed_at DESC
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_github_installations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_github_installation(UUID) TO authenticated;

COMMENT ON FUNCTION get_github_installations IS 'Returns active GitHub App installations for an EnvManager organization';
COMMENT ON FUNCTION get_github_installation IS 'Returns the newest active GitHub App installation for backward compatibility';
