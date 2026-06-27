-- =====================================================
-- PROXY CRITICAL FIXES (Code Review)
-- Migration: 20260306082603_proxy_critical_fixes_review.sql
-- Fixes:
--   1. Atomic increment_proxy_invocation (race condition fix)
--   2. Restrict secret_token from RLS SELECT (column-level grants)
--   3. Fix check_and_increment_rate_limit to not count blocked requests
--   4. Add service_role bypass to get_proxy_overage (fixes report-proxy-usage)
--   5. GRANT SELECT on analytics views to authenticated
--   6. Fix validate_proxy_secret_mappings to check existence (not just cross-org)
--   7. Revoke get_proxy_overage from authenticated (service-only)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Atomic increment_proxy_invocation (fixes race condition)
-- Uses single upsert with conditional increment to prevent overshoot
-- =====================================================

CREATE OR REPLACE FUNCTION increment_proxy_invocation(
    p_proxy_function_id UUID,
    p_organization_id UUID,
    p_monthly_limit INTEGER,
    p_hard_cap INTEGER DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
    current_period TEXT := to_char(now(), 'YYYY-MM');
    current_count INTEGER;
    effective_hard_cap INTEGER := COALESCE(p_hard_cap, p_monthly_limit * 10);
BEGIN
    -- Atomic upsert: only increment if below hard cap
    INSERT INTO proxy_invocations (proxy_function_id, organization_id, period, call_count, last_called_at)
    VALUES (p_proxy_function_id, p_organization_id, current_period, 1, now())
    ON CONFLICT (proxy_function_id, period)
    DO UPDATE SET
        call_count = CASE
            WHEN proxy_invocations.call_count >= effective_hard_cap THEN proxy_invocations.call_count
            ELSE proxy_invocations.call_count + 1
        END,
        last_called_at = now(),
        updated_at = now()
    RETURNING call_count INTO current_count;

    -- If count >= cap, it's blocked (the CASE prevented increment)
    IF current_count >= effective_hard_cap THEN
        RETURN 'hard_blocked';
    ELSIF current_count <= p_monthly_limit THEN
        RETURN 'within_limit';
    ELSE
        RETURN 'soft_exceeded';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION increment_proxy_invocation(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, authenticated, anon;

-- =====================================================
-- 2. Restrict secret_token from authenticated SELECT
-- Column-level grants exclude secret_token from regular queries
-- Service role retains full access via its own policy
-- =====================================================

REVOKE SELECT ON proxy_functions FROM authenticated;
GRANT SELECT (
    id, organization_id, environment_id, name, slug, description, enabled,
    target_url, http_method, target_headers, secret_mappings,
    allowed_origins, request_body_template, pass_through_body,
    rate_limit_per_minute, template_id, created_by, created_at, updated_at
) ON proxy_functions TO authenticated;

-- =====================================================
-- 3. Fix check_and_increment_rate_limit: check first, then increment
-- Blocked requests no longer consume a rate limit slot
-- =====================================================

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
    p_proxy_function_id UUID,
    p_rate_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
    current_window TIMESTAMPTZ := date_trunc('minute', now());
    current_count INTEGER;
BEGIN
    -- Read current count first (without incrementing)
    SELECT request_count INTO current_count
    FROM proxy_rate_limits
    WHERE proxy_function_id = p_proxy_function_id AND window_start = current_window;

    -- If already at limit, deny without incrementing
    IF current_count IS NOT NULL AND current_count >= p_rate_limit THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current', current_count,
            'limit', p_rate_limit,
            'remaining', 0,
            'reset', extract(epoch from current_window + interval '1 minute')::bigint
        );
    END IF;

    -- Below limit: atomically increment
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

REVOKE EXECUTE ON FUNCTION check_and_increment_rate_limit(UUID, INTEGER) FROM PUBLIC, authenticated, anon;

-- =====================================================
-- 4. Fix get_proxy_overage: add service_role bypass
-- report-proxy-usage calls this with service_role where auth.uid() is NULL
-- =====================================================

CREATE OR REPLACE FUNCTION get_proxy_overage(
    p_organization_id UUID,
    p_period TEXT,
    p_included_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
    total_calls INTEGER;
    overage INTEGER;
BEGIN
    -- Allow service_role through (used by report-proxy-usage edge function)
    IF auth.role() != 'service_role' THEN
        IF NOT EXISTS (
            SELECT 1 FROM organization_members
            WHERE organization_id = p_organization_id AND user_id = auth.uid()
        ) AND NOT (SELECT is_platform_admin()) THEN
            RAISE EXCEPTION 'Unauthorized';
        END IF;
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

-- Restrict to service_role only
REVOKE EXECUTE ON FUNCTION get_proxy_overage(UUID, TEXT, INTEGER) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION get_proxy_overage(UUID, TEXT, INTEGER) TO service_role;

-- =====================================================
-- 5. GRANT SELECT on analytics views to authenticated
-- Views use security_invoker=true so RLS on underlying table applies
-- =====================================================

GRANT SELECT ON proxy_analytics_daily TO authenticated;
GRANT SELECT ON proxy_analytics_hourly TO authenticated;

-- =====================================================
-- 6. Fix validate_proxy_secret_mappings: positive existence check
-- Previously only checked cross-org; non-existent variable_ids passed silently
-- =====================================================

CREATE OR REPLACE FUNCTION validate_proxy_secret_mappings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    mapping JSONB;
    var_id UUID;
BEGIN
    IF NEW.secret_mappings IS NULL OR jsonb_array_length(NEW.secret_mappings) = 0 THEN
        RETURN NEW;
    END IF;

    FOR mapping IN SELECT jsonb_array_elements(NEW.secret_mappings)
    LOOP
        var_id := (mapping->>'variable_id')::UUID;

        -- Variable must exist AND belong to this organization
        IF NOT EXISTS (
            SELECT 1 FROM variables v
            JOIN environments e ON e.id = v.environment_id
            JOIN projects p ON p.id = e.project_id
            WHERE v.id = var_id
            AND p.organization_id = NEW.organization_id
        ) THEN
            RAISE EXCEPTION 'secret_mappings contains unknown or unauthorized variable_id %', var_id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

COMMIT;
