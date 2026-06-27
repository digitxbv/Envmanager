-- =====================================================
-- Environment Access Update Function
-- =====================================================
-- This function provides atomic updates to environment access
-- preventing race conditions from separate delete/insert operations

CREATE OR REPLACE FUNCTION update_user_environment_access(
  p_user_id UUID,
  p_organization_id UUID,
  p_environment_ids UUID[],
  p_granted_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify requesting user has admin/owner permissions
  IF NOT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied: Only owners and admins can modify environment access';
  END IF;

  -- Verify target user is a member of the organization
  IF NOT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
    AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Target user is not a member of this organization';
  END IF;

  -- Delete existing access (atomic within transaction)
  DELETE FROM environment_access
  WHERE user_id = p_user_id
  AND organization_id = p_organization_id;

  -- Insert new access records if environment_ids is not empty
  IF array_length(p_environment_ids, 1) > 0 THEN
    INSERT INTO environment_access (user_id, environment_id, organization_id, granted_by)
    SELECT p_user_id, unnest(p_environment_ids), p_organization_id, p_granted_by;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_user_environment_access(UUID, UUID, UUID[], UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION update_user_environment_access IS
'Atomically updates environment access for a user. Only owners and admins can execute this function.';
