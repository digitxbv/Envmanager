-- =====================================================
-- PROXY RATE LIMITS — Sliding Window Counter
-- Migration: 20260226200040_proxy_rate_limits.sql
-- Description: Add rate_limit_per_minute to proxy_functions,
--              create proxy_rate_limits table, and
--              check_and_increment_rate_limit RPC
-- =====================================================

-- =====================================================
-- 1. Add rate_limit_per_minute to proxy_functions
-- =====================================================

ALTER TABLE proxy_functions ADD COLUMN rate_limit_per_minute INTEGER;
-- NULL = no rate limit applied

COMMENT ON COLUMN proxy_functions.rate_limit_per_minute IS 'Max requests per minute for this proxy function. NULL means no rate limit.';

-- =====================================================
-- 2. proxy_rate_limits table (sliding window counters)
-- =====================================================

CREATE TABLE proxy_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proxy_function_id UUID NOT NULL REFERENCES proxy_functions(id) ON DELETE CASCADE,
    window_start TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(proxy_function_id, window_start)
);

CREATE INDEX idx_proxy_rate_limits_lookup ON proxy_rate_limits(proxy_function_id, window_start DESC);

-- RLS: service role only — no user access needed for rate limit data
ALTER TABLE proxy_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proxy_rate_limits_service_role" ON proxy_rate_limits
    FOR ALL USING (auth.role() = 'service_role');

-- TODO: pg_cron job to prune old rate limit windows
-- DELETE FROM proxy_rate_limits WHERE window_start < now() - interval '1 hour';

-- =====================================================
-- 3. check_and_increment_rate_limit RPC
-- =====================================================

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
    p_proxy_function_id UUID,
    p_rate_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
    current_window TIMESTAMPTZ := date_trunc('minute', now());
    current_count INTEGER;
BEGIN
    -- Upsert the current window counter (atomic)
    INSERT INTO proxy_rate_limits (proxy_function_id, window_start, request_count)
    VALUES (p_proxy_function_id, current_window, 1)
    ON CONFLICT (proxy_function_id, window_start)
    DO UPDATE SET request_count = proxy_rate_limits.request_count + 1, updated_at = now()
    RETURNING request_count INTO current_count;

    -- Return status
    RETURN jsonb_build_object(
        'allowed', current_count <= p_rate_limit,
        'current', current_count,
        'limit', p_rate_limit,
        'remaining', GREATEST(0, p_rate_limit - current_count),
        'reset', extract(epoch from current_window + interval '1 minute')::bigint
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_and_increment_rate_limit(UUID, INTEGER) IS
    'Atomically increments the per-minute request counter for a proxy function and returns rate limit status. If the RPC takes >500ms, the caller should allow the request through (graceful degradation).';

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE proxy_rate_limits IS 'Sliding window per-minute request counters for proxy function rate limiting.';
