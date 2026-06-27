-- Auth Audit Logging (PRD 09 / SEC-013)
-- Logs authentication events for security monitoring and compliance

-- 1. Create audit log table
CREATE TABLE auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  email TEXT,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_auth_audit_user_id ON auth_audit_log(user_id, created_at DESC);
CREATE INDEX idx_auth_audit_event_type ON auth_audit_log(event_type, created_at DESC);

-- 2. RLS
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert" ON auth_audit_log
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Users can read own logs" ON auth_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 3. RPC function for client-side logging
-- SECURITY DEFINER to bypass RLS for inserts
-- Accepts optional email for unauthenticated events (failed logins)
CREATE OR REPLACE FUNCTION log_auth_event(
  p_event_type TEXT,
  p_success BOOLEAN,
  p_email TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO auth_audit_log (
    event_type, user_id, email, ip_address, user_agent, success, metadata
  ) VALUES (
    p_event_type,
    auth.uid(),
    COALESCE(
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      p_email
    ),
    nullif(current_setting('request.headers', true)::json->>'x-forwarded-for', '')::inet,
    current_setting('request.headers', true)::json->>'user-agent',
    p_success,
    p_metadata
  );
END;
$$;

-- Grant to both anon (for failed login logging) and authenticated
GRANT EXECUTE ON FUNCTION log_auth_event TO anon;
GRANT EXECUTE ON FUNCTION log_auth_event TO authenticated;
