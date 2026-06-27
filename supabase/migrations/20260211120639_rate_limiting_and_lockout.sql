-- ============================================================
-- Rate Limiting & Account Lockout (PRD 08)
-- SEC-007: No Rate Limiting, SEC-014: No Account Lockout
-- ============================================================

-- Track failed login attempts
CREATE TABLE login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address INET,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL
);

CREATE INDEX idx_login_attempts_email ON login_attempts(email, attempted_at DESC);

-- Track locked accounts
CREATE TABLE account_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  locked_until TIMESTAMPTZ NOT NULL,
  failed_attempts INT DEFAULT 0
);

-- Enable RLS but no direct access policies (access only via SECURITY DEFINER functions)
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_locks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- check_account_lock: Check if an account is currently locked
-- Returns lock status and remaining attempts without revealing account existence
-- ============================================================
CREATE OR REPLACE FUNCTION check_account_lock(target_email TEXT)
RETURNS TABLE (is_locked BOOLEAN, locked_until TIMESTAMPTZ, attempts_remaining INT)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  lock_record RECORD;
  recent_failures INT;
  max_attempts INT := 5;
BEGIN
  -- Check for active lock
  SELECT * INTO lock_record FROM account_locks al
  WHERE al.email = target_email AND al.locked_until > NOW();

  IF FOUND THEN
    RETURN QUERY SELECT true, lock_record.locked_until, 0;
    RETURN;
  END IF;

  -- Count recent failures in the lockout window
  SELECT COUNT(*) INTO recent_failures FROM login_attempts la
  WHERE la.email = target_email AND la.success = false
  AND la.attempted_at > NOW() - INTERVAL '15 minutes';

  RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, GREATEST(0, max_attempts - recent_failures);
END;
$$;

-- ============================================================
-- record_login_attempt: Record a login attempt and lock if threshold reached
-- ============================================================
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
BEGIN
  INSERT INTO login_attempts (email, ip_address, success)
  VALUES (target_email, attempt_ip, was_successful);

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

-- Grant execute to both anon (pre-login) and authenticated roles
GRANT EXECUTE ON FUNCTION check_account_lock(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_login_attempt(TEXT, INET, BOOLEAN) TO anon, authenticated;

COMMENT ON TABLE login_attempts IS 'Tracks login attempts for account lockout. Prune records older than 30 days.';
COMMENT ON TABLE account_locks IS 'Tracks temporarily locked accounts after too many failed login attempts.';
