-- =====================================================
-- APPROVAL WORKFLOWS SCHEMA
-- =====================================================
-- Created: 2026-02-05
-- Description: Add database-level support for protected environments
--              with approval workflows. Changes to protected environments
--              are staged as pending changes until approved.
-- Dependency: has_environment_write_access() from granular access control
-- =====================================================

BEGIN;

-- =====================================================
-- 1. ADD PROTECTION SETTINGS TO ENVIRONMENTS
-- =====================================================

ALTER TABLE environments
ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_mode TEXT CHECK (approval_mode IS NULL OR approval_mode IN ('single', 'specific', 'two_person')),
ADD COLUMN IF NOT EXISTS auto_expire_hours INTEGER DEFAULT 0;

COMMENT ON COLUMN environments.is_protected IS 'Whether environment requires approval for changes';
COMMENT ON COLUMN environments.approval_mode IS 'How approvals work: single (any member), specific (designated approvers), two_person (requires 2 approvers)';
COMMENT ON COLUMN environments.auto_expire_hours IS 'Hours until pending changes expire (0 = never)';

-- =====================================================
-- 2. ENVIRONMENT APPROVERS TABLE (for specific mode)
-- =====================================================

CREATE TABLE IF NOT EXISTS environment_approvers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(environment_id, user_id)
);

COMMENT ON TABLE environment_approvers IS 'Designated approvers per environment for specific approval mode';

-- =====================================================
-- 3. PENDING CHANGES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS pending_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  variable_id UUID REFERENCES variables(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),

  -- For create/update: new values
  variable_key TEXT,
  variable_value TEXT,
  is_secret BOOLEAN DEFAULT false,

  -- For update/delete: old values (for diff display)
  old_key TEXT,
  old_value TEXT,

  -- Metadata
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ DEFAULT now(),
  comment TEXT,

  -- Approval tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- For two_person mode
  first_approver UUID REFERENCES auth.users(id),
  first_approved_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ
);

COMMENT ON TABLE pending_changes IS 'Queue of staged changes awaiting approval for protected environments';

-- =====================================================
-- 4. INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pending_changes_environment_status
ON pending_changes(environment_id, status);

CREATE INDEX IF NOT EXISTS idx_pending_changes_organization_status
ON pending_changes(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_pending_changes_requested_by
ON pending_changes(requested_by);

CREATE INDEX IF NOT EXISTS idx_environment_approvers_env
ON environment_approvers(environment_id);

CREATE INDEX IF NOT EXISTS idx_environment_approvers_user
ON environment_approvers(user_id);

-- =====================================================
-- 5. RLS POLICIES FOR ENVIRONMENT_APPROVERS
-- =====================================================

ALTER TABLE environment_approvers ENABLE ROW LEVEL SECURITY;

-- View approvers: anyone in organization can see
CREATE POLICY "Organization members can view approvers"
ON environment_approvers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM environments e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = environment_approvers.environment_id
    AND om.user_id = auth.uid()
  )
);

-- Manage approvers: admins and owners only
CREATE POLICY "Admins can manage approvers"
ON environment_approvers FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM environments e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = environment_approvers.environment_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM environments e
    JOIN organization_members om ON om.organization_id = e.organization_id
    WHERE e.id = environment_approvers.environment_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- =====================================================
-- 6. RLS POLICIES FOR PENDING_CHANGES
-- =====================================================

ALTER TABLE pending_changes ENABLE ROW LEVEL SECURITY;

-- View pending changes: anyone in organization can see
CREATE POLICY "Organization members can view pending changes"
ON pending_changes FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Create pending changes: via RPC function only
CREATE POLICY "Pending changes created via RPC"
ON pending_changes FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Update pending changes: requester can cancel, approvers can approve/reject
CREATE POLICY "Update pending changes"
ON pending_changes FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 7. RPC FUNCTIONS
-- =====================================================

-- Check if environment is protected
CREATE OR REPLACE FUNCTION is_environment_protected(p_environment_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(is_protected, false)
  FROM environments
  WHERE id = p_environment_id;
$$;

GRANT EXECUTE ON FUNCTION is_environment_protected(UUID) TO authenticated;

COMMENT ON FUNCTION is_environment_protected IS 'Check if an environment requires approval for changes';

-- Check if user can approve pending changes for an environment
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
      -- Any member with write access can approve (except requester)
      RETURN v_requested_by != auth.uid()
        AND v_user_role IN ('owner', 'admin', 'member');

    WHEN 'specific' THEN
      -- Only designated approvers (except requester)
      RETURN v_requested_by != auth.uid()
        AND EXISTS (
          SELECT 1 FROM environment_approvers
          WHERE environment_id = v_env_id
          AND user_id = auth.uid()
        );

    WHEN 'two_person' THEN
      -- Two different approvers, neither can be requester
      RETURN v_requested_by != auth.uid()
        AND (v_first_approver IS NULL OR v_first_approver != auth.uid())
        AND v_user_role IN ('owner', 'admin', 'member');

    ELSE
      RETURN false;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION can_approve_pending_change(UUID) TO authenticated;

COMMENT ON FUNCTION can_approve_pending_change IS 'Check if current user can approve a pending change based on approval mode';

-- Submit a pending change
CREATE OR REPLACE FUNCTION submit_pending_change(
  p_environment_id UUID,
  p_action TEXT,
  p_variable_id UUID DEFAULT NULL,
  p_key TEXT DEFAULT NULL,
  p_value TEXT DEFAULT NULL,
  p_is_secret BOOLEAN DEFAULT false,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_change_id UUID;
  v_org_id UUID;
  v_is_protected BOOLEAN;
  v_auto_expire INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_old_key TEXT;
  v_old_value TEXT;
BEGIN
  -- Get environment details
  SELECT organization_id, is_protected, auto_expire_hours
  INTO v_org_id, v_is_protected, v_auto_expire
  FROM environments
  WHERE id = p_environment_id;

  -- Verify environment exists and is protected
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Environment not found';
  END IF;

  IF NOT v_is_protected THEN
    RAISE EXCEPTION 'Environment is not protected. Use direct variable operations.';
  END IF;

  -- Verify user has write access to the environment
  IF NOT has_environment_write_access(p_environment_id) THEN
    RAISE EXCEPTION 'No write access to this environment';
  END IF;

  -- Get old values for update/delete
  IF p_action IN ('update', 'delete') AND p_variable_id IS NOT NULL THEN
    SELECT key, value INTO v_old_key, v_old_value
    FROM variables
    WHERE id = p_variable_id;
  END IF;

  -- Calculate expiration
  IF v_auto_expire > 0 THEN
    v_expires_at := now() + (v_auto_expire || ' hours')::INTERVAL;
  END IF;

  -- Create pending change
  INSERT INTO pending_changes (
    environment_id, organization_id, variable_id, action,
    variable_key, variable_value, is_secret,
    old_key, old_value,
    requested_by, comment, expires_at
  ) VALUES (
    p_environment_id, v_org_id, p_variable_id, p_action,
    p_key, p_value, p_is_secret,
    v_old_key, v_old_value,
    auth.uid(), p_comment, v_expires_at
  )
  RETURNING id INTO v_change_id;

  RETURN v_change_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_pending_change(UUID, TEXT, UUID, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;

COMMENT ON FUNCTION submit_pending_change IS 'Submit a variable change for approval on a protected environment';

-- Approve a pending change
CREATE OR REPLACE FUNCTION approve_pending_change(p_change_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_change RECORD;
  v_approval_mode TEXT;
  v_needs_second_approval BOOLEAN := false;
BEGIN
  -- Get change and verify can approve
  SELECT pc.*, e.approval_mode
  INTO v_change
  FROM pending_changes pc
  JOIN environments e ON e.id = pc.environment_id
  WHERE pc.id = p_change_id
  AND pc.status = 'pending';

  IF v_change.id IS NULL THEN
    RAISE EXCEPTION 'Pending change not found or already processed';
  END IF;

  IF NOT can_approve_pending_change(p_change_id) THEN
    RAISE EXCEPTION 'You cannot approve this change';
  END IF;

  v_approval_mode := v_change.approval_mode;

  -- Handle two_person mode
  IF v_approval_mode = 'two_person' THEN
    IF v_change.first_approver IS NULL THEN
      -- First approval
      UPDATE pending_changes
      SET first_approver = auth.uid(),
          first_approved_at = now()
      WHERE id = p_change_id;
      RETURN true; -- Still needs second approval
    END IF;
    -- Second approval continues below
  END IF;

  -- Mark as approved
  UPDATE pending_changes
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = p_change_id;

  -- Apply the change
  PERFORM apply_pending_change(p_change_id);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_pending_change(UUID) TO authenticated;

COMMENT ON FUNCTION approve_pending_change IS 'Approve a pending change. For two_person mode, first call records first approver, second call completes approval';

-- Reject a pending change
CREATE OR REPLACE FUNCTION reject_pending_change(
  p_change_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_change_exists BOOLEAN;
BEGIN
  -- Verify change exists and user can approve (approvers can reject too)
  SELECT EXISTS (
    SELECT 1 FROM pending_changes
    WHERE id = p_change_id AND status = 'pending'
  ) INTO v_change_exists;

  IF NOT v_change_exists THEN
    RAISE EXCEPTION 'Pending change not found or already processed';
  END IF;

  IF NOT can_approve_pending_change(p_change_id) THEN
    RAISE EXCEPTION 'You cannot reject this change';
  END IF;

  -- Mark as rejected
  UPDATE pending_changes
  SET status = 'rejected',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      rejection_reason = p_reason
  WHERE id = p_change_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION reject_pending_change(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION reject_pending_change IS 'Reject a pending change with optional reason';

-- Apply an approved pending change (internal function)
-- Note: The vault trigger will automatically handle secret creation when is_secret=true
CREATE OR REPLACE FUNCTION apply_pending_change(p_change_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_change RECORD;
  v_new_variable_id UUID;
BEGIN
  SELECT * INTO v_change
  FROM pending_changes
  WHERE id = p_change_id AND status = 'approved';

  IF v_change.id IS NULL THEN
    RAISE EXCEPTION 'Change must be approved before applying';
  END IF;

  CASE v_change.action
    WHEN 'create' THEN
      -- Insert new variable (vault trigger handles secret creation automatically)
      INSERT INTO variables (
        environment_id, organization_id, key, value, is_secret
      ) VALUES (
        v_change.environment_id, v_change.organization_id,
        v_change.variable_key, v_change.variable_value, v_change.is_secret
      )
      RETURNING id INTO v_new_variable_id;

      -- Update pending_change with new variable_id for audit
      UPDATE pending_changes
      SET variable_id = v_new_variable_id
      WHERE id = p_change_id;

    WHEN 'update' THEN
      -- Update existing variable (vault trigger handles secret update automatically)
      UPDATE variables
      SET key = COALESCE(v_change.variable_key, key),
          value = COALESCE(v_change.variable_value, value),
          is_secret = COALESCE(v_change.is_secret, is_secret),
          updated_at = now()
      WHERE id = v_change.variable_id;

    WHEN 'delete' THEN
      -- Delete variable (vault cleanup trigger handles secret deletion automatically)
      DELETE FROM variables
      WHERE id = v_change.variable_id;
  END CASE;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION apply_pending_change IS 'Internal function to apply an approved pending change. Called by approve_pending_change after approval';

-- Expire pending changes (to be called by scheduled job)
CREATE OR REPLACE FUNCTION expire_pending_changes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE pending_changes
  SET status = 'expired',
      reviewed_at = now()
  WHERE status = 'pending'
  AND expires_at IS NOT NULL
  AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_pending_changes() TO authenticated;

COMMENT ON FUNCTION expire_pending_changes IS 'Expire pending changes that have passed their expiration time. Can be called by a scheduled job';

-- =====================================================
-- 8. MIGRATION COMPLETE
-- =====================================================

COMMIT;

-- Summary of changes:
-- Schema:
--   - Added is_protected, approval_mode, auto_expire_hours to environments
--   - Created environment_approvers table
--   - Created pending_changes table
-- Indexes:
--   - idx_pending_changes_environment_status
--   - idx_pending_changes_organization_status
--   - idx_pending_changes_requested_by
--   - idx_environment_approvers_env
--   - idx_environment_approvers_user
-- RLS:
--   - environment_approvers: org members can view, admins can manage
--   - pending_changes: org members can view, create, update
-- Functions:
--   - is_environment_protected()
--   - can_approve_pending_change()
--   - submit_pending_change()
--   - approve_pending_change()
--   - reject_pending_change()
--   - apply_pending_change()
--   - expire_pending_changes()
