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
    'total_projects', (SELECT COUNT(*)::INT FROM projects),
    'total_environments', (SELECT COUNT(*)::INT FROM environments),
    'total_variables', (SELECT COUNT(*)::INT FROM variables),
    'plan_distribution', COALESCE((
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          plan_id,
          status,
          COUNT(*)::INT AS count
        FROM organization_subscriptions
        GROUP BY plan_id, status
        ORDER BY plan_id, status
      ) t
    ), '[]'::JSON)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_platform_stats IS
  'Returns platform-wide organization, user, project, environment, variable, and subscription distribution stats for platform admins.';

CREATE OR REPLACE FUNCTION get_platform_organization_counts(org_id UUID)
RETURNS TABLE (
  projects_count INT,
  environments_count INT,
  variables_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (SELECT is_platform_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INT FROM projects p WHERE p.organization_id = org_id) AS projects_count,
    (SELECT COUNT(*)::INT FROM environments e WHERE e.organization_id = org_id) AS environments_count,
    (SELECT COUNT(*)::INT FROM variables v WHERE v.organization_id = org_id) AS variables_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_platform_organization_counts(UUID) TO authenticated;

COMMENT ON FUNCTION get_platform_organization_counts(UUID) IS
  'Returns project, environment, and variable counts for a single organization. Platform admins only.';
