-- =====================================================
-- ENRICHED INVOCATION LOGGING
-- Migration: 20260226200036_enriched_invocation_logging.sql
-- Description: Add per-request invocation log table for detailed analytics.
--              The existing proxy_invocations table remains unchanged (v1 aggregate).
--              This new table captures per-request detail for analytics only.
-- =====================================================

-- =====================================================
-- 1. proxy_invocation_logs table (per-request detail)
-- =====================================================

CREATE TABLE proxy_invocation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proxy_function_id UUID NOT NULL REFERENCES proxy_functions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    status_code INTEGER,
    response_time_ms INTEGER,
    error_type TEXT,        -- NULL for success, 'timeout', 'target_error', 'rate_limited', 'limit_exceeded'
    origin TEXT,            -- Request origin header
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proxy_invocation_logs_proxy_time ON proxy_invocation_logs(proxy_function_id, requested_at DESC);
CREATE INDEX idx_proxy_invocation_logs_org_time ON proxy_invocation_logs(organization_id, requested_at DESC);

-- =====================================================
-- 2. RLS Policies
-- =====================================================

ALTER TABLE proxy_invocation_logs ENABLE ROW LEVEL SECURITY;

-- Org members can view logs for their own org (analytics dashboard)
CREATE POLICY "proxy_invocation_logs_select" ON proxy_invocation_logs
    FOR SELECT USING (
        organization_id IN (SELECT get_user_organization_ids())
    );

-- Service role only for writes (edge function inserts)
CREATE POLICY "proxy_invocation_logs_service_insert" ON proxy_invocation_logs
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "proxy_invocation_logs_service_all" ON proxy_invocation_logs
    FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON proxy_invocation_logs TO authenticated;

-- =====================================================
-- 3. Analytics Views
-- =====================================================

-- Daily aggregation view
CREATE OR REPLACE VIEW proxy_analytics_daily AS
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

-- Hourly aggregation view (last 7 days for detailed view)
CREATE OR REPLACE VIEW proxy_analytics_hourly AS
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
-- 4. Data Retention Note
-- =====================================================

-- TODO: Add pg_cron job to prune proxy_invocation_logs older than 90 days
-- DELETE FROM proxy_invocation_logs WHERE requested_at < now() - interval '90 days';

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE proxy_invocation_logs IS 'Per-request invocation detail log for analytics. Coexists with proxy_invocations (v1 aggregate counter). Do not use for billing — use proxy_invocations instead.';
COMMENT ON COLUMN proxy_invocation_logs.error_type IS 'NULL on success. One of: timeout, target_error, rate_limited, limit_exceeded';
COMMENT ON VIEW proxy_analytics_daily IS 'Daily aggregation of proxy invocation logs per proxy function and org';
COMMENT ON VIEW proxy_analytics_hourly IS 'Hourly aggregation of proxy invocation logs for the last 7 days';
