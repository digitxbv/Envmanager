-- =====================================================
-- PROXY SECURITY FIXES V2
-- Migration: 20260304100000_proxy_security_fixes_v2.sql
-- Description:
--   1. Rewrite increment_proxy_invocation to accept hard cap and refuse
--      to increment beyond it (prevents billing inflation on rejected requests)
--   2. Recreate analytics views with security_invoker = true
--   3. Add DB-level trigger to validate secret_mappings variable ownership
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Rewrite increment_proxy_invocation with hard cap support
-- =====================================================
-- Returns TEXT: 'within_limit', 'soft_exceeded', or 'hard_blocked'
-- 'hard_blocked' does NOT increment the counter.

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
    -- Check current count BEFORE incrementing
    SELECT call_count INTO current_count
    FROM proxy_invocations
    WHERE proxy_function_id = p_proxy_function_id AND period = current_period;

    -- If already at or above hard cap, block without incrementing
    IF current_count IS NOT NULL AND current_count >= effective_hard_cap THEN
        RETURN 'hard_blocked';
    END IF;

    -- Safe to increment
    INSERT INTO proxy_invocations (proxy_function_id, organization_id, period, call_count, last_called_at)
    VALUES (p_proxy_function_id, p_organization_id, current_period, 1, now())
    ON CONFLICT (proxy_function_id, period)
    DO UPDATE SET call_count = proxy_invocations.call_count + 1, last_called_at = now(), updated_at = now()
    RETURNING call_count INTO current_count;

    IF current_count <= p_monthly_limit THEN
        RETURN 'within_limit';
    ELSE
        RETURN 'soft_exceeded';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke from non-service roles (matches existing security fix)
REVOKE EXECUTE ON FUNCTION increment_proxy_invocation(UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, authenticated, anon;

-- =====================================================
-- 2. Recreate analytics views with security_invoker = true
-- =====================================================

DROP VIEW IF EXISTS proxy_analytics_daily;
CREATE VIEW proxy_analytics_daily
WITH (security_invoker = true)
AS
SELECT
    proxy_function_id,
    organization_id,
    date_trunc('day', requested_at)::date AS day,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299) AS success_count,
    COUNT(*) FILTER (WHERE status_code BETWEEN 400 AND 499) AS client_error_count,
    COUNT(*) FILTER (WHERE status_code >= 500 OR error_type IS NOT NULL) AS server_error_count,
    AVG(response_time_ms)::integer AS avg_response_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms)::integer AS p95_response_time_ms
FROM proxy_invocation_logs
GROUP BY proxy_function_id, organization_id, date_trunc('day', requested_at)::date;

DROP VIEW IF EXISTS proxy_analytics_hourly;
CREATE VIEW proxy_analytics_hourly
WITH (security_invoker = true)
AS
SELECT
    proxy_function_id,
    organization_id,
    date_trunc('hour', requested_at) AS hour,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE status_code BETWEEN 200 AND 299) AS success_count,
    COUNT(*) FILTER (WHERE status_code >= 400 OR error_type IS NOT NULL) AS error_count,
    AVG(response_time_ms)::integer AS avg_response_time_ms
FROM proxy_invocation_logs
WHERE requested_at > now() - interval '7 days'
GROUP BY proxy_function_id, organization_id, date_trunc('hour', requested_at);

-- =====================================================
-- 3. Trigger to validate secret_mappings variable ownership on INSERT/UPDATE
-- =====================================================
-- Prevents storing variable_ids from other organizations in secret_mappings.

CREATE OR REPLACE FUNCTION validate_proxy_secret_mappings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    mapping JSONB;
    var_id UUID;
    foreign_count INTEGER;
BEGIN
    -- Skip if no secret_mappings
    IF NEW.secret_mappings IS NULL OR jsonb_array_length(NEW.secret_mappings) = 0 THEN
        RETURN NEW;
    END IF;

    -- Collect all variable_ids from the mappings
    FOR mapping IN SELECT jsonb_array_elements(NEW.secret_mappings)
    LOOP
        var_id := (mapping->>'variable_id')::UUID;

        -- Check: variable must exist in an environment that belongs to this org
        SELECT COUNT(*) INTO foreign_count
        FROM variables v
        JOIN environments e ON e.id = v.environment_id
        JOIN projects p ON p.id = e.project_id
        WHERE v.id = var_id
        AND p.organization_id != NEW.organization_id;

        IF foreign_count > 0 THEN
            RAISE EXCEPTION 'secret_mappings contains variable_id % that does not belong to organization %', var_id, NEW.organization_id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_proxy_secret_mappings
    BEFORE INSERT OR UPDATE OF secret_mappings ON proxy_functions
    FOR EACH ROW
    EXECUTE FUNCTION validate_proxy_secret_mappings();

COMMIT;
