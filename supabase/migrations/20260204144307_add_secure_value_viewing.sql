-- =====================================================
-- Secure Value Viewing - Schema & API (PRD 03-02)
-- =====================================================
-- Time-limited access grants for viewing production secrets
-- with full audit trail and rate limiting.

BEGIN;

-- =====================================================
-- Tables
-- =====================================================

-- Temporary access grants
CREATE TABLE temporary_access_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_id UUID NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
  environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Request details
  requested_by UUID NOT NULL REFERENCES auth.users(id),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  request_reason TEXT NOT NULL,

  -- Approval status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'expired', 'revoked')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  denial_reason TEXT,

  -- Access window (set when approved)
  access_duration_minutes INTEGER,
  access_expires_at TIMESTAMPTZ,

  -- Rate limiting
  reveal_count INTEGER NOT NULL DEFAULT 0,
  max_reveals INTEGER NOT NULL DEFAULT 50,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient access checks
CREATE INDEX idx_temp_grants_variable_user
  ON temporary_access_grants(variable_id, requested_by, status);
CREATE INDEX idx_temp_grants_status_expires
  ON temporary_access_grants(status, access_expires_at)
  WHERE status = 'approved';
CREATE INDEX idx_temp_grants_org_pending
  ON temporary_access_grants(organization_id, status)
  WHERE status = 'pending';

-- Secret view audit log
CREATE TABLE secret_view_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id UUID NOT NULL REFERENCES temporary_access_grants(id) ON DELETE CASCADE,
  variable_id UUID NOT NULL REFERENCES variables(id) ON DELETE CASCADE,
  viewed_by UUID NOT NULL REFERENCES auth.users(id),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_secret_view_log_grant ON secret_view_log(grant_id);
CREATE INDEX idx_secret_view_log_variable ON secret_view_log(variable_id, viewed_at);

-- Updated_at trigger
CREATE TRIGGER update_temporary_access_grants_updated_at
  BEFORE UPDATE ON temporary_access_grants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE temporary_access_grants ENABLE ROW LEVEL SECURITY;

-- Users can see grants for their organization
CREATE POLICY "Users can view grants in their organization"
ON temporary_access_grants FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT get_user_organization_ids())
);

-- Users can request access (insert their own requests)
CREATE POLICY "Users can request access"
ON temporary_access_grants FOR INSERT
TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND organization_id IN (SELECT get_user_organization_ids())
);

-- Only admins/owners can approve/deny (update)
CREATE POLICY "Admins can review access requests"
ON temporary_access_grants FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- RLS for secret_view_log
ALTER TABLE secret_view_log ENABLE ROW LEVEL SECURITY;

-- Users can see their own view logs + admins see all in org
CREATE POLICY "Users can view own logs, admins see all"
ON secret_view_log FOR SELECT
TO authenticated
USING (
  viewed_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM temporary_access_grants g
    JOIN organization_members om ON om.organization_id = g.organization_id
    WHERE g.id = secret_view_log.grant_id
    AND om.user_id = auth.uid()
    AND om.role IN ('owner', 'admin')
  )
);

-- Log entries created via RPC only (no direct insert)
CREATE POLICY "View logs created via RPC"
ON secret_view_log FOR INSERT
TO authenticated
WITH CHECK (false);

-- =====================================================
-- RPC Functions
-- =====================================================

-- Request access to view a secret
CREATE OR REPLACE FUNCTION request_secret_access(
  p_variable_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_env_id UUID;
  v_org_id UUID;
  v_grant_id UUID;
  v_existing_pending UUID;
BEGIN
  -- Get environment and organization from variable
  SELECT v.environment_id, v.organization_id
  INTO v_env_id, v_org_id
  FROM variables v
  WHERE v.id = p_variable_id
  AND v.is_secret = true;

  IF v_env_id IS NULL THEN
    RAISE EXCEPTION 'Variable not found or is not a secret';
  END IF;

  -- Verify user is in organization
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Check for existing pending request
  SELECT id INTO v_existing_pending
  FROM temporary_access_grants
  WHERE variable_id = p_variable_id
  AND requested_by = auth.uid()
  AND status = 'pending';

  IF v_existing_pending IS NOT NULL THEN
    RAISE EXCEPTION 'Pending request already exists';
  END IF;

  -- Check for active grant
  IF EXISTS (
    SELECT 1 FROM temporary_access_grants
    WHERE variable_id = p_variable_id
    AND requested_by = auth.uid()
    AND status = 'approved'
    AND access_expires_at > now()
  ) THEN
    RAISE EXCEPTION 'You already have active access to this secret';
  END IF;

  -- Create the request
  INSERT INTO temporary_access_grants (
    variable_id, environment_id, organization_id,
    requested_by, request_reason
  ) VALUES (
    p_variable_id, v_env_id, v_org_id,
    auth.uid(), p_reason
  ) RETURNING id INTO v_grant_id;

  RETURN v_grant_id;
END;
$$;

-- Grant access to a request
CREATE OR REPLACE FUNCTION grant_access(
  p_grant_id UUID,
  p_duration_minutes INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Validate duration (min 15 min, max 24 hours)
  IF p_duration_minutes < 15 OR p_duration_minutes > 1440 THEN
    RAISE EXCEPTION 'Duration must be between 15 minutes and 24 hours';
  END IF;

  -- Get grant's organization
  SELECT organization_id INTO v_org_id
  FROM temporary_access_grants
  WHERE id = p_grant_id AND status = 'pending';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Grant not found or not pending';
  END IF;

  -- Check if current user is admin/owner
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can approve access requests';
  END IF;

  -- Approve the grant
  UPDATE temporary_access_grants
  SET status = 'approved',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      access_duration_minutes = p_duration_minutes,
      access_expires_at = now() + (p_duration_minutes || ' minutes')::interval,
      updated_at = now()
  WHERE id = p_grant_id;

  RETURN true;
END;
$$;

-- Deny access to a request
CREATE OR REPLACE FUNCTION deny_access(
  p_grant_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Get grant's organization
  SELECT organization_id INTO v_org_id
  FROM temporary_access_grants
  WHERE id = p_grant_id AND status = 'pending';

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Grant not found or not pending';
  END IF;

  -- Check if current user is admin/owner
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = v_org_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can deny access requests';
  END IF;

  -- Deny the grant
  UPDATE temporary_access_grants
  SET status = 'denied',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      denial_reason = p_reason,
      updated_at = now()
  WHERE id = p_grant_id;

  RETURN true;
END;
$$;

-- Reveal secret value (with logging and rate limiting)
CREATE OR REPLACE FUNCTION reveal_secret_value(
  p_variable_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grant_id UUID;
  v_reveal_count INTEGER;
  v_max_reveals INTEGER;
  v_decrypted_value TEXT;
BEGIN
  -- Find active grant for this user and variable
  SELECT id, reveal_count, max_reveals
  INTO v_grant_id, v_reveal_count, v_max_reveals
  FROM temporary_access_grants
  WHERE variable_id = p_variable_id
  AND requested_by = auth.uid()
  AND status = 'approved'
  AND access_expires_at > now()
  ORDER BY access_expires_at DESC
  LIMIT 1;

  IF v_grant_id IS NULL THEN
    RAISE EXCEPTION 'No active access grant for this secret';
  END IF;

  -- Rate limiting check
  IF v_reveal_count >= v_max_reveals THEN
    RAISE EXCEPTION 'Rate limit exceeded for this access grant';
  END IF;

  -- Increment reveal count
  UPDATE temporary_access_grants
  SET reveal_count = reveal_count + 1,
      updated_at = now()
  WHERE id = v_grant_id;

  -- Log the view (bypass RLS via SECURITY DEFINER)
  INSERT INTO secret_view_log (grant_id, variable_id, viewed_by, ip_address, user_agent)
  VALUES (v_grant_id, p_variable_id, auth.uid(), p_ip_address, p_user_agent);

  -- Decrypt and return the value
  SELECT decrypt_variable_value(p_variable_id) INTO v_decrypted_value;

  RETURN v_decrypted_value;
END;
$$;

-- Expire old grants (called by scheduled function or manually)
CREATE OR REPLACE FUNCTION expire_old_grants()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE temporary_access_grants
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'approved'
  AND access_expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Helper: Check if user has active access to a variable
CREATE OR REPLACE FUNCTION has_temporary_access(p_variable_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM temporary_access_grants
    WHERE variable_id = p_variable_id
    AND requested_by = auth.uid()
    AND status = 'approved'
    AND access_expires_at > now()
  );
$$;

-- Helper: Get pending request count for organization
CREATE OR REPLACE FUNCTION get_pending_access_requests_count(p_org_id UUID)
RETURNS INTEGER
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM temporary_access_grants
  WHERE organization_id = p_org_id
  AND status = 'pending';
$$;

-- =====================================================
-- Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION request_secret_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION grant_access(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION deny_access(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reveal_secret_value(UUID, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_grants() TO authenticated;
GRANT EXECUTE ON FUNCTION has_temporary_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_access_requests_count(UUID) TO authenticated;

COMMIT;
