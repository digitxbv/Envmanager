-- =====================================================
-- METERED BILLING SCHEMA
-- Migration: 20260226200057_metered_billing_schema.sql
-- Description: Update billing schema to support metered proxy invocation billing.
--              Adds overage tracking to proxy_invocations, Stripe metered item
--              tracking to organization_subscriptions, and get_proxy_overage RPC.
-- =====================================================

-- =====================================================
-- 1. Add overage tracking to proxy_invocations
-- =====================================================
-- proxy_invocations_monthly plan limits stay the same (free=500, pro=5000, enterprise=50000)
-- but now represent "included" quota, not a hard block.
-- The 10x safety valve (hard block) is enforced in the edge function, not in the DB.

ALTER TABLE proxy_invocations ADD COLUMN overage_reported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE proxy_invocations ADD COLUMN overage_reported_at TIMESTAMPTZ;

COMMENT ON COLUMN proxy_invocations.overage_reported IS 'Whether this period''s overage has been reported to Stripe';
COMMENT ON COLUMN proxy_invocations.overage_reported_at IS 'Timestamp when overage was last reported to Stripe';

-- =====================================================
-- 2. Add Stripe metered item tracking to organization_subscriptions
-- =====================================================

ALTER TABLE organization_subscriptions
    ADD COLUMN proxy_metered_item_id TEXT;

COMMENT ON COLUMN organization_subscriptions.proxy_metered_item_id IS 'Stripe subscription_item.id for proxy usage metered billing. Set when org upgrades to a plan with metered proxy billing.';

-- =====================================================
-- 3. RPC: get_proxy_overage
-- =====================================================

CREATE OR REPLACE FUNCTION get_proxy_overage(
    p_organization_id UUID,
    p_period TEXT,              -- YYYY-MM format
    p_included_limit INTEGER
) RETURNS JSONB AS $$
DECLARE
    total_calls INTEGER;
    overage INTEGER;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_proxy_overage(UUID, TEXT, INTEGER) IS 'Calculate proxy invocation overage for an org in a given billing period (YYYY-MM). Returns total_calls, included_limit, overage count, is_over flag.';

GRANT EXECUTE ON FUNCTION get_proxy_overage(UUID, TEXT, INTEGER) TO authenticated;

-- =====================================================
-- Note: STRIPE_METERED_PROXY_PRICE_ID must be set in Supabase secrets
-- before the stripe-metered-billing edge function (Task 05) can work.
-- =====================================================