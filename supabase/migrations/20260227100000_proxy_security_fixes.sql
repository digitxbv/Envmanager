-- =====================================================
-- PROXY SECURITY FIXES
-- Migration: 20260227100000_proxy_security_fixes.sql
-- Description: Fix security issues found in proxy migrations:
--   1. Add SET search_path to SECURITY DEFINER functions
--   2. Revoke public execute on service-only functions
--   3. Add org membership check to get_proxy_overage
--   4. Add WITH CHECK to proxy_functions UPDATE policy (prevent org_id mutation)
--   5. Change allowed_origins default from '["*"]' to '[]'
--   6. Add cross-reference check in proxy_functions INSERT policy
--   7. Remove redundant proxy_invocation_logs_service_insert policy
--   8. Add CHECK constraint on proxy_invocations.period format
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CRITICAL: Add SET search_path to SECURITY DEFINER functions
-- =====================================================

-- 1a. log_proxy_function_change (trigger function from 20260226145136)
CREATE OR REPLACE FUNCTION log_proxy_function_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    audit_action TEXT;
    audit_changes JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        audit_action := 'created';
        audit_changes := jsonb_build_object(
            'name', NEW.name,
            'slug', NEW.slug,
            'target_url', NEW.target_url,
            'http_method', NEW.http_method,
            'enabled', NEW.enabled
        );
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.enabled != NEW.enabled THEN
            audit_action := CASE WHEN NEW.enabled THEN 'enabled' ELSE 'disabled' END;
        ELSE
            audit_action := 'updated';
        END IF;
        audit_changes := jsonb_build_object(
            'old', jsonb_build_object(
                'name', OLD.name,
                'slug', OLD.slug,
                'target_url', OLD.target_url,
                'http_method', OLD.http_method,
                'enabled', OLD.enabled,
                'allowed_origins', OLD.allowed_origins
            ),
            'new', jsonb_build_object(
                'name', NEW.name,
                'slug', NEW.slug,
                'target_url', NEW.target_url,
                'http_method', NEW.http_method,
                'enabled', NEW.enabled,
                'allowed_origins', NEW.allowed_origins
            )
        );
    ELSIF TG_OP = 'DELETE' THEN
        audit_action := 'deleted';
        audit_changes := jsonb_build_object(
            'name', OLD.name,
            'slug', OLD.slug,
            'target_url', OLD.target_url
        );
    END IF;

    INSERT INTO proxy_function_audit_log (
        proxy_function_id,
        organization_id,
        action,
        changed_by,
        changes
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        COALESCE(NEW.organization_id, OLD.organization_id),
        audit_action,
        auth.uid(),
        audit_changes
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- 1b. increment_proxy_invocation (from 20260226145136)
CREATE OR REPLACE FUNCTION increment_proxy_invocation(
    p_proxy_function_id UUID,
    p_organization_id UUID,
    p_monthly_limit INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_period TEXT := to_char(now(), 'YYYY-MM');
    current_count INTEGER;
BEGIN
    INSERT INTO proxy_invocations (proxy_function_id, organization_id, period, call_count, last_called_at)
    VALUES (p_proxy_function_id, p_organization_id, current_period, 1, now())
    ON CONFLICT (proxy_function_id, period)
    DO UPDATE SET call_count = proxy_invocations.call_count + 1, last_called_at = now(), updated_at = now()
    RETURNING call_count INTO current_count;

    RETURN current_count <= p_monthly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1c. check_and_increment_rate_limit (from 20260226200040)
CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
    p_proxy_function_id UUID,
    p_rate_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
    current_window TIMESTAMPTZ := date_trunc('minute', now());
    current_count INTEGER;
BEGIN
    INSERT INTO proxy_rate_limits (proxy_function_id, window_start, request_count)
    VALUES (p_proxy_function_id, current_window, 1)
    ON CONFLICT (proxy_function_id, window_start)
    DO UPDATE SET request_count = proxy_rate_limits.request_count + 1, updated_at = now()
    RETURNING request_count INTO current_count;

    RETURN jsonb_build_object(
        'allowed', current_count <= p_rate_limit,
        'current', current_count,
        'limit', p_rate_limit,
        'remaining', GREATEST(0, p_rate_limit - current_count),
        'reset', extract(epoch from current_window + interval '1 minute')::bigint
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1d. get_proxy_overage (from 20260226200057) — also adds org membership check (#3)
CREATE OR REPLACE FUNCTION get_proxy_overage(
    p_organization_id UUID,
    p_period TEXT,
    p_included_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
    total_calls INTEGER;
    overage INTEGER;
BEGIN
    -- Verify caller is a member of the org or a platform admin
    IF NOT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_organization_id AND user_id = auth.uid()
    ) AND NOT (SELECT is_platform_admin()) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT COALESCE(SUM(call_count), 0) INTO total_calls
    FROM proxy_invocations
    WHERE organization_id = p_organization_id
    AND period = p_period;

    overage := GREATEST(0, total_calls - p_included_limit);

    RETURN jsonb_build_object(
        'total_calls', total_calls,
        'included_limit', p_included_limit,
        'overage', overage,
        'is_over', overage > 0,
        'period', p_period
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- =====================================================
-- 2. CRITICAL: Revoke execute from PUBLIC on service-only functions
-- =====================================================

REVOKE EXECUTE ON FUNCTION increment_proxy_invocation(UUID, UUID, INTEGER) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION check_and_increment_rate_limit(UUID, INTEGER) FROM PUBLIC, authenticated, anon;

-- =====================================================
-- 4. HIGH: Add WITH CHECK to proxy_functions UPDATE policy (prevent org_id mutation)
-- =====================================================

DROP POLICY IF EXISTS "proxy_functions_update" ON proxy_functions;
CREATE POLICY "proxy_functions_update" ON proxy_functions
    FOR UPDATE USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = proxy_functions.organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = proxy_functions.organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'owner')
        )
    );

-- =====================================================
-- 5. MEDIUM: Change allowed_origins default from '["*"]' to '[]'
-- =====================================================

ALTER TABLE proxy_functions ALTER COLUMN allowed_origins SET DEFAULT '[]'::jsonb;

-- =====================================================
-- 7. MEDIUM: Add cross-reference check in proxy_functions INSERT policy
--    (environment_id must belong to same org)
-- =====================================================

DROP POLICY IF EXISTS "proxy_functions_insert" ON proxy_functions;
CREATE POLICY "proxy_functions_insert" ON proxy_functions
    FOR INSERT WITH CHECK (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = proxy_functions.organization_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'owner')
        )
        AND EXISTS (
            SELECT 1 FROM environments
            WHERE environments.id = proxy_functions.environment_id
            AND environments.project_id IN (
                SELECT p.id FROM projects p WHERE p.organization_id = proxy_functions.organization_id
            )
        )
    );

-- =====================================================
-- 8. MEDIUM: Remove redundant proxy_invocation_logs_service_insert policy
--    (already covered by proxy_invocation_logs_service_all FOR ALL)
-- =====================================================

DROP POLICY IF EXISTS "proxy_invocation_logs_service_insert" ON proxy_invocation_logs;

-- =====================================================
-- 9. MEDIUM: Add CHECK constraint on proxy_invocations.period for YYYY-MM format
-- =====================================================

ALTER TABLE proxy_invocations ADD CONSTRAINT proxy_invocations_period_format
    CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$');

COMMIT;
