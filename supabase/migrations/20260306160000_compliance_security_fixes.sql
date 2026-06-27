-- =====================================================
-- Compliance & Security Fixes
-- Addresses: MFA bypass, account deletion, data export,
-- login DoS prevention, data retention automation
-- =====================================================

-- =====================================================
-- 1. FIX: MFA Recovery Bypass (CRITICAL)
-- Move recovery verification state from user_metadata
-- (user-writable) to server-side table
-- =====================================================

CREATE TABLE mfa_recovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mfa_recovery_sessions_user ON mfa_recovery_sessions(user_id, created_at DESC);

ALTER TABLE mfa_recovery_sessions ENABLE ROW LEVEL SECURITY;

-- No direct client access - only via SECURITY DEFINER functions
CREATE POLICY "Deny all direct access to mfa_recovery_sessions"
  ON mfa_recovery_sessions FOR ALL
  TO authenticated
  USING (false);

GRANT SELECT ON mfa_recovery_sessions TO authenticated;

-- Update verify_recovery_code to also create a recovery session
CREATE OR REPLACE FUNCTION verify_recovery_code(input_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    code_record RECORD;
    remaining_count INT;
BEGIN
    -- Find matching unused code
    SELECT id INTO code_record
    FROM user_recovery_codes
    WHERE user_id = auth.uid()
        AND used_at IS NULL
        AND code_hash = crypt(upper(trim(input_code)), code_hash)
    LIMIT 1;

    IF code_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or already used recovery code');
    END IF;

    -- Mark code as used
    UPDATE user_recovery_codes
    SET used_at = now()
    WHERE id = code_record.id;

    -- Count remaining codes
    SELECT COUNT(*) INTO remaining_count
    FROM user_recovery_codes
    WHERE user_id = auth.uid() AND used_at IS NULL;

    -- Create server-side recovery session (replaces user_metadata approach)
    -- Clean up old sessions first
    DELETE FROM mfa_recovery_sessions WHERE user_id = auth.uid();
    INSERT INTO mfa_recovery_sessions (user_id) VALUES (auth.uid());

    -- Audit log
    INSERT INTO security_audit_log (user_id, action, details)
    VALUES (auth.uid(), 'recovery_code_used', jsonb_build_object('remaining', remaining_count));

    RETURN jsonb_build_object(
        'success', true,
        'remaining_codes', remaining_count,
        'warning', CASE WHEN remaining_count < 3 THEN 'Low recovery codes remaining' ELSE NULL END
    );
END;
$$;

-- RPC to check if user has an active recovery bypass session
CREATE OR REPLACE FUNCTION check_mfa_recovery_bypass()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM mfa_recovery_sessions
        WHERE user_id = auth.uid()
        AND created_at > NOW() - INTERVAL '24 hours'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION check_mfa_recovery_bypass() TO authenticated;

-- =====================================================
-- 2. FIX: Login Attempt DoS Prevention (MEDIUM)
-- Add IP-based rate limiting inside record_login_attempt
-- to prevent anonymous callers from locking out arbitrary accounts
-- =====================================================

CREATE OR REPLACE FUNCTION record_login_attempt(
  target_email TEXT, attempt_ip INET, was_successful BOOLEAN
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  recent_failures INT;
  max_attempts INT := 5;
  lockout_duration INTERVAL := '15 minutes';
  caller_ip INET;
  ip_recent_calls INT;
BEGIN
  -- Get actual caller IP from request headers (not the user-supplied parameter)
  caller_ip := nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', '')::inet;

  -- Rate limit: if this IP has made >15 failed-attempt recordings in 5 minutes, ignore
  IF NOT was_successful AND caller_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO ip_recent_calls
    FROM login_attempts
    WHERE ip_address = caller_ip
      AND success = false
      AND attempted_at > NOW() - INTERVAL '5 minutes';

    IF ip_recent_calls >= 15 THEN
      RETURN; -- Silently ignore to prevent DoS
    END IF;
  END IF;

  -- Use actual caller IP instead of user-supplied parameter
  INSERT INTO login_attempts (email, ip_address, success)
  VALUES (target_email, caller_ip, was_successful);

  -- On successful login, clear any existing lock
  IF was_successful THEN
    DELETE FROM account_locks WHERE email = target_email;
    RETURN;
  END IF;

  -- Count recent failures
  SELECT COUNT(*) INTO recent_failures FROM login_attempts la
  WHERE la.email = target_email AND la.success = false
  AND la.attempted_at > NOW() - lockout_duration;

  -- Lock account if threshold reached
  IF recent_failures >= max_attempts THEN
    INSERT INTO account_locks (email, locked_until, failed_attempts)
    VALUES (target_email, NOW() + lockout_duration, recent_failures)
    ON CONFLICT (email) DO UPDATE SET
      locked_at = NOW(),
      locked_until = NOW() + lockout_duration,
      failed_attempts = recent_failures;
  END IF;
END;
$$;

-- =====================================================
-- 3. FIX: Account Deletion (CRITICAL - GDPR Art. 17)
-- =====================================================

CREATE OR REPLACE FUNCTION delete_user_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sole_owner_orgs UUID[];
  v_org RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check for orgs where user is the sole owner
  SELECT array_agg(om.organization_id) INTO v_sole_owner_orgs
  FROM organization_members om
  WHERE om.user_id = v_user_id AND om.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM organization_members om2
    WHERE om2.organization_id = om.organization_id
      AND om2.user_id != v_user_id
      AND om2.role = 'owner'
  );

  -- For each sole-owner org, check if there are other members
  IF v_sole_owner_orgs IS NOT NULL THEN
    FOR v_org IN
      SELECT o.id, o.name, COUNT(om.user_id) as member_count
      FROM organizations o
      JOIN organization_members om ON om.organization_id = o.id
      WHERE o.id = ANY(v_sole_owner_orgs)
      GROUP BY o.id, o.name
      HAVING COUNT(om.user_id) > 1
    LOOP
      -- Org has other members but user is sole owner - block deletion
      RETURN jsonb_build_object(
        'success', false,
        'error', 'You are the sole owner of organization "' || v_org.name || '" which has other members. Please transfer ownership or remove members first.'
      );
    END LOOP;

    -- Delete orgs where user is the only member (safe to delete)
    DELETE FROM organizations WHERE id = ANY(v_sole_owner_orgs);
  END IF;

  -- Delete the user (CASCADE will handle organization_members, etc.)
  DELETE FROM auth.users WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account() TO authenticated;

-- =====================================================
-- 4. FIX: Data Export (MEDIUM - GDPR Art. 20)
-- =====================================================

CREATE OR REPLACE FUNCTION export_user_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jsonb_build_object(
    'export_date', NOW(),
    'user_id', v_user_id,
    'account', (
      SELECT jsonb_build_object(
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'email_confirmed_at', u.email_confirmed_at
      )
      FROM auth.users u WHERE u.id = v_user_id
    ),
    'organizations', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', o.name,
        'role', om.role,
        'joined_at', om.created_at
      )), '[]'::jsonb)
      FROM organization_members om
      JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = v_user_id
    ),
    'projects', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', p.name,
        'description', p.description,
        'created_at', p.created_at
      )), '[]'::jsonb)
      FROM projects p
      JOIN organizations o ON o.id = p.organization_id
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = v_user_id
    ),
    'variables', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', v.key,
        'environment', e.name,
        'project', p.name,
        'is_secret', v.is_secret,
        'created_at', v.created_at,
        'updated_at', v.updated_at
      )), '[]'::jsonb)
      FROM variables v
      JOIN environments e ON e.id = v.environment_id
      JOIN projects p ON p.id = e.project_id
      JOIN organizations o ON o.id = p.organization_id
      JOIN organization_members om ON om.organization_id = o.id
      WHERE om.user_id = v_user_id
    ),
    'audit_log', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'action', al.action,
        'variable_key', al.variable_key,
        'created_at', al.created_at
      )), '[]'::jsonb)
      FROM variable_audit_log al
      WHERE al.user_id = v_user_id
    ),
    'auth_events', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'event_type', aal.event_type,
        'success', aal.success,
        'created_at', aal.created_at
      )), '[]'::jsonb)
      FROM auth_audit_log aal
      WHERE aal.user_id = v_user_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION export_user_data() TO authenticated;

-- =====================================================
-- 5. FIX: Data Retention Cron Jobs (MEDIUM)
-- =====================================================

-- Prune login_attempts older than 30 days
SELECT cron.schedule(
  'cleanup-login-attempts',
  '30 2 * * *',
  'DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL ''30 days'';'
);

-- Prune expired account_locks older than 1 day
SELECT cron.schedule(
  'cleanup-account-locks',
  '35 2 * * *',
  'DELETE FROM account_locks WHERE locked_until < NOW() - INTERVAL ''1 day'';'
);

-- Prune mfa_recovery_sessions older than 7 days
SELECT cron.schedule(
  'cleanup-mfa-recovery-sessions',
  '40 2 * * *',
  'DELETE FROM mfa_recovery_sessions WHERE created_at < NOW() - INTERVAL ''7 days'';'
);

-- Prune variable_access_log older than 90 days
SELECT cron.schedule(
  'cleanup-variable-access-log',
  '45 2 * * *',
  'DELETE FROM variable_access_log WHERE accessed_at < NOW() - INTERVAL ''90 days'';'
);

-- Prune auth_audit_log older than 2 years
SELECT cron.schedule(
  'cleanup-auth-audit-log',
  '50 2 * * *',
  'DELETE FROM auth_audit_log WHERE created_at < NOW() - INTERVAL ''2 years'';'
);

-- Prune secret_view_log older than 1 year
SELECT cron.schedule(
  'cleanup-secret-view-log',
  '55 2 * * *',
  'DELETE FROM secret_view_log WHERE viewed_at < NOW() - INTERVAL ''1 year'';'
);

-- Prune expired temporary_access_grants older than 30 days past expiry
SELECT cron.schedule(
  'cleanup-expired-access-grants',
  '0 3 * * *',
  'DELETE FROM temporary_access_grants WHERE expires_at < NOW() - INTERVAL ''30 days'';'
);

-- =====================================================
-- 6. FIX: Missing ON DELETE CASCADE for user_id FKs
-- Required for account deletion to work properly
-- =====================================================

ALTER TABLE auth_audit_log DROP CONSTRAINT IF EXISTS auth_audit_log_user_id_fkey;
ALTER TABLE auth_audit_log ADD CONSTRAINT auth_audit_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE import_history DROP CONSTRAINT IF EXISTS import_history_user_id_fkey;
ALTER TABLE import_history ADD CONSTRAINT import_history_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE variable_access_log DROP CONSTRAINT IF EXISTS variable_access_log_user_id_fkey;
ALTER TABLE variable_access_log ADD CONSTRAINT variable_access_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON TABLE mfa_recovery_sessions IS 'Server-side MFA recovery bypass sessions. Replaces user_metadata approach for security.';
COMMENT ON FUNCTION check_mfa_recovery_bypass IS 'Check if user has an active MFA recovery bypass (within 24 hours). Used by auth middleware.';
COMMENT ON FUNCTION delete_user_account IS 'GDPR Art. 17 - Right to erasure. Deletes user account and all associated data.';
COMMENT ON FUNCTION export_user_data IS 'GDPR Art. 20 - Data portability. Exports all user data as JSON.';
