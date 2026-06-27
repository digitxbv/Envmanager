-- =====================================================
-- Recovery Codes & Security Audit Log
-- PRD: 04b - TOTP 2FA Recovery Codes
-- =====================================================

-- Ensure pgcrypto is available for bcrypt hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- Security Audit Log (for 2FA events)
-- =====================================================

CREATE TABLE security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN (
        '2fa_enabled', '2fa_disabled', '2fa_codes_generated', 'recovery_code_used'
    )),
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_audit_log_user_id ON security_audit_log(user_id);
CREATE INDEX idx_security_audit_log_action ON security_audit_log(action);
CREATE INDEX idx_security_audit_log_created_at ON security_audit_log(created_at DESC);

ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own security audit log"
    ON security_audit_log FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE from client — only via SECURITY DEFINER functions
CREATE POLICY "Deny direct inserts to security audit log"
    ON security_audit_log FOR INSERT
    TO authenticated
    WITH CHECK (false);

GRANT SELECT ON security_audit_log TO authenticated;

-- =====================================================
-- User Recovery Codes
-- =====================================================

CREATE TABLE user_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recovery_codes_user_id ON user_recovery_codes(user_id);
CREATE INDEX idx_recovery_codes_unused ON user_recovery_codes(user_id) WHERE used_at IS NULL;

ALTER TABLE user_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can see metadata (count) but not hashes directly — use RPC
CREATE POLICY "Users can view own recovery code metadata"
    ON user_recovery_codes FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE — only via SECURITY DEFINER functions
CREATE POLICY "Deny direct inserts to recovery codes"
    ON user_recovery_codes FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "Deny direct updates to recovery codes"
    ON user_recovery_codes FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "Deny direct deletes to recovery codes"
    ON user_recovery_codes FOR DELETE
    TO authenticated
    USING (false);

GRANT SELECT ON user_recovery_codes TO authenticated;

-- =====================================================
-- RPC: Generate Recovery Codes
-- =====================================================

CREATE OR REPLACE FUNCTION generate_recovery_codes()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    codes TEXT[] := '{}';
    code TEXT;
    i INT;
BEGIN
    -- Delete any existing codes for this user
    DELETE FROM user_recovery_codes WHERE user_id = auth.uid();

    -- Generate 10 new codes
    FOR i IN 1..10 LOOP
        code := upper(
            substr(md5(random()::text || clock_timestamp()::text), 1, 5) || '-' ||
            substr(md5(random()::text || clock_timestamp()::text), 1, 5)
        );

        INSERT INTO user_recovery_codes (user_id, code_hash)
        VALUES (auth.uid(), crypt(code, gen_salt('bf')));

        codes := array_append(codes, code);
    END LOOP;

    -- Audit log
    INSERT INTO security_audit_log (user_id, action, details)
    VALUES (auth.uid(), '2fa_codes_generated', jsonb_build_object('count', 10));

    RETURN codes;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_recovery_codes() TO authenticated;

-- =====================================================
-- RPC: Verify Recovery Code
-- =====================================================

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

GRANT EXECUTE ON FUNCTION verify_recovery_code(TEXT) TO authenticated;

-- =====================================================
-- RPC: Get Remaining Recovery Codes Count
-- =====================================================

CREATE OR REPLACE FUNCTION get_remaining_recovery_codes_count()
RETURNS INT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
    SELECT COUNT(*)::INT
    FROM user_recovery_codes
    WHERE user_id = auth.uid() AND used_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION get_remaining_recovery_codes_count() TO authenticated;

COMMENT ON TABLE security_audit_log IS 'Immutable audit log for security-related events (2FA enable/disable, recovery code usage)';
COMMENT ON TABLE user_recovery_codes IS 'Hashed recovery codes for 2FA backup authentication. Each code is single-use.';
COMMENT ON FUNCTION generate_recovery_codes IS 'Generates 10 new recovery codes, deletes old ones, returns plaintext for one-time display';
COMMENT ON FUNCTION verify_recovery_code IS 'Verifies a recovery code, marks it consumed, returns remaining count';
COMMENT ON FUNCTION get_remaining_recovery_codes_count IS 'Returns count of unused recovery codes for current user';
