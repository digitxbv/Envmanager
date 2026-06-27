-- =====================================================
-- GET GITHUB PROJECT SYNC CONFIG RPC FUNCTION
-- Migration: 20260130132915_github_get_project_sync_config.sql
-- Description: Retrieve GitHub project sync config by project_id
-- =====================================================

CREATE OR REPLACE FUNCTION get_github_project_sync_config(p_project_id UUID)
RETURNS SETOF github_project_sync_configs
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT * FROM github_project_sync_configs
    WHERE project_id = p_project_id
    LIMIT 1;
$$;

-- Grant execute to authenticated users (RLS on the table handles access control)
GRANT EXECUTE ON FUNCTION get_github_project_sync_config TO authenticated;

COMMENT ON FUNCTION get_github_project_sync_config IS 'Retrieve GitHub project sync config for a given project_id';
