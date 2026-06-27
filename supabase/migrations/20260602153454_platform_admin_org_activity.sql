CREATE OR REPLACE FUNCTION get_platform_organization_activity()
RETURNS TABLE (
  organization_id UUID,
  env_var_count INT,
  last_sign_in_at TIMESTAMPTZ
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
    o.id AS organization_id,
    COALESCE(v.cnt, 0)::INT AS env_var_count,
    m.last_sign_in_at
  FROM organizations o
  LEFT JOIN (
    SELECT vr.organization_id, COUNT(*) AS cnt
    FROM variables vr
    WHERE vr.is_secret = true
       OR (vr.value IS NOT NULL AND length(trim(vr.value)) > 0)
    GROUP BY vr.organization_id
  ) v ON v.organization_id = o.id
  LEFT JOIN (
    SELECT om.organization_id, MAX(au.last_sign_in_at) AS last_sign_in_at
    FROM organization_members om
    JOIN auth.users au ON au.id = om.user_id
    GROUP BY om.organization_id
  ) m ON m.organization_id = o.id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_platform_organization_activity() TO authenticated;

COMMENT ON FUNCTION get_platform_organization_activity() IS
  'Returns non-empty variable count and most-recent member sign-in per organization. Platform admins only.';
