-- Migration: Update environment access function to support access levels

BEGIN;

-- p_access_levels format: [{"environment_id": "uuid", "access_level": "read|write"}, ...]
CREATE OR REPLACE FUNCTION update_user_environment_access(
  p_user_id UUID,
  p_organization_id UUID,
  p_environment_ids UUID[],
  p_granted_by UUID,
  p_access_levels JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: Only owners and admins can modify environment access';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Target user is not a member of this organization';
  END IF;

  DELETE FROM environment_access
  WHERE user_id = p_user_id
  AND organization_id = p_organization_id;

  IF p_access_levels IS NOT NULL AND jsonb_array_length(p_access_levels) > 0 THEN
    INSERT INTO environment_access (user_id, environment_id, organization_id, granted_by, access_level)
    SELECT
      p_user_id,
      (item->>'environment_id')::UUID,
      p_organization_id,
      p_granted_by,
      COALESCE(item->>'access_level', 'write')
    FROM jsonb_array_elements(p_access_levels) AS item;
  ELSIF array_length(p_environment_ids, 1) > 0 THEN
    -- Backward compatible fallback: flat array defaults to 'write'
    INSERT INTO environment_access (user_id, environment_id, organization_id, granted_by, access_level)
    SELECT p_user_id, unnest(p_environment_ids), p_organization_id, p_granted_by, 'write';
  END IF;
END;
$$;

COMMIT;
