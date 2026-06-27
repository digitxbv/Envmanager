-- Restrict pending change approvals to admin/owner only (remove member)
CREATE OR REPLACE FUNCTION can_approve_pending_change(p_change_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_env_id UUID;
  v_approval_mode TEXT;
  v_requested_by UUID;
  v_first_approver UUID;
  v_org_id UUID;
  v_user_role TEXT;
BEGIN
  -- Get change details
  SELECT environment_id, requested_by, first_approver
  INTO v_env_id, v_requested_by, v_first_approver
  FROM pending_changes
  WHERE id = p_change_id;

  IF v_env_id IS NULL THEN
    RETURN false;
  END IF;

  -- Get environment settings
  SELECT approval_mode, organization_id
  INTO v_approval_mode, v_org_id
  FROM environments
  WHERE id = v_env_id;

  -- Get user's role
  SELECT role INTO v_user_role
  FROM organization_members
  WHERE organization_id = v_org_id AND user_id = auth.uid();

  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;

  -- Check based on approval mode
  CASE v_approval_mode
    WHEN 'single' THEN
      -- Only admin/owner can approve (except requester)
      RETURN v_requested_by != auth.uid()
        AND v_user_role IN ('owner', 'admin');

    WHEN 'specific' THEN
      -- Only designated approvers who are admin/owner (except requester)
      RETURN v_requested_by != auth.uid()
        AND v_user_role IN ('owner', 'admin')
        AND EXISTS (
          SELECT 1 FROM environment_approvers
          WHERE environment_id = v_env_id
          AND user_id = auth.uid()
        );

    WHEN 'two_person' THEN
      -- Two different admin/owner approvers, neither can be requester
      RETURN v_requested_by != auth.uid()
        AND (v_first_approver IS NULL OR v_first_approver != auth.uid())
        AND v_user_role IN ('owner', 'admin');

    ELSE
      RETURN false;
  END CASE;
END;
$$;
