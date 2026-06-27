-- Migration: Access Tracking RPC Functions
-- PRD: 02 — Variable Dependencies (Phase 4: Access Tracking)
-- TODO: Add cleanup policy for variable_access_log (retain 90 days)

-- ============================================================
-- 1. log_variable_access
--    Logs access for all variables in an environment (batch insert)
-- ============================================================
CREATE OR REPLACE FUNCTION log_variable_access(
  p_environment_id UUID,
  p_access_type TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_count BIGINT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate access_type
  IF p_access_type NOT IN ('cli_pull', 'api_fetch', 'web_view', 'web_decrypt') THEN
    RAISE EXCEPTION 'Invalid access_type: %', p_access_type;
  END IF;

  -- Get organization_id from the environment
  SELECT p.organization_id INTO v_org_id
  FROM environments e
  JOIN projects p ON p.id = e.project_id
  WHERE e.id = p_environment_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Environment not found';
  END IF;

  -- Batch insert one row per variable in the environment
  INSERT INTO variable_access_log (variable_id, environment_id, organization_id, user_id, access_type, metadata)
  SELECT v.id, p_environment_id, v_org_id, v_user_id, p_access_type, p_metadata
  FROM variables v
  WHERE v.environment_id = p_environment_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 2. get_variable_access_stats
--    Returns access stats for a single variable grouped by type
-- ============================================================
CREATE OR REPLACE FUNCTION get_variable_access_stats(
  p_variable_id UUID,
  p_days INT DEFAULT 7
)
RETURNS TABLE(
  access_type TEXT,
  access_count BIGINT,
  last_access TIMESTAMPTZ,
  unique_users BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    val.access_type,
    COUNT(*)::BIGINT AS access_count,
    MAX(val.accessed_at) AS last_access,
    COUNT(DISTINCT val.user_id)::BIGINT AS unique_users
  FROM variable_access_log val
  WHERE val.variable_id = p_variable_id
    AND val.accessed_at >= now() - (p_days || ' days')::INTERVAL
  GROUP BY val.access_type;
END;
$$;

-- ============================================================
-- 3. get_environment_access_summary
--    Returns per-variable access counts for an environment
-- ============================================================
CREATE OR REPLACE FUNCTION get_environment_access_summary(
  p_environment_id UUID,
  p_days INT DEFAULT 7
)
RETURNS TABLE(
  variable_id UUID,
  total_accesses BIGINT,
  last_accessed TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    val.variable_id,
    COUNT(*)::BIGINT AS total_accesses,
    MAX(val.accessed_at) AS last_accessed
  FROM variable_access_log val
  WHERE val.environment_id = p_environment_id
    AND val.accessed_at >= now() - (p_days || ' days')::INTERVAL
    AND val.variable_id IS NOT NULL
  GROUP BY val.variable_id;
END;
$$;
