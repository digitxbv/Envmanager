-- =====================================================
-- BILLING DOMAIN TABLES
-- Migration: 20251020150000_billing_schema.sql
-- Description: Comprehensive billing system with subscription plans,
--              organization subscriptions, billing events, and usage tracking
-- =====================================================

-- =====================================================
-- Subscription Plans Table
-- =====================================================
-- Source of truth for plan definitions and limits

CREATE TABLE subscription_plans (
    id TEXT PRIMARY KEY, -- 'free', 'pro_monthly', 'pro_annual'
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL, -- 0 for free, 2900 for pro monthly, 27840 for annual
    billing_interval TEXT CHECK (billing_interval IN ('month', 'year', 'lifetime')),
    stripe_price_id TEXT, -- Stripe Price ID

    -- Feature Limits (JSONB for flexibility)
    limits JSONB NOT NULL DEFAULT '{
        "projects": 3,
        "environments_per_project": 3,
        "variables_per_environment": 50,
        "team_members": 1,
        "audit_log_retention_days": 7
    }'::jsonb,

    -- Features (array of feature flags)
    features JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['audit_logs', 'sso', 'priority_support']

    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Organization Subscriptions Table
-- =====================================================
-- One subscription per organization

CREATE TABLE organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,

    -- Current Subscription State
    plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
    status TEXT NOT NULL CHECK (status IN (
        'trialing',      -- Active trial
        'active',        -- Paid and active
        'past_due',      -- Payment failed but still accessible
        'canceled',      -- Canceled, still active until period end
        'unpaid',        -- Hard block (payment failed multiple times)
        'incomplete',    -- Initial payment incomplete
        'paused'         -- Manually paused by admin
    )),

    -- Stripe Integration
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,

    -- Trial Management
    trial_start_date TIMESTAMPTZ,
    trial_end_date TIMESTAMPTZ,

    -- Subscription Dates
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
    canceled_at TIMESTAMPTZ,

    -- Downgrade Management
    scheduled_plan_change_id TEXT REFERENCES subscription_plans(id), -- Plan to switch to at period end
    scheduled_change_date TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_trial CHECK (
        (trial_start_date IS NULL AND trial_end_date IS NULL) OR
        (trial_start_date IS NOT NULL AND trial_end_date IS NOT NULL AND trial_end_date > trial_start_date)
    )
);

-- =====================================================
-- Billing Events Audit Trail
-- =====================================================

CREATE TABLE billing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE SET NULL,

    -- Event Details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'subscription_created',
        'subscription_updated',
        'subscription_canceled',
        'subscription_renewed',
        'trial_started',
        'trial_ended',
        'trial_converted',
        'payment_succeeded',
        'payment_failed',
        'plan_upgraded',
        'plan_downgraded',
        'limit_reached',
        'limit_exceeded_blocked'
    )),

    -- Event Context
    from_plan_id TEXT REFERENCES subscription_plans(id),
    to_plan_id TEXT REFERENCES subscription_plans(id),

    -- Details
    details JSONB DEFAULT '{}'::jsonb,
    stripe_event_id TEXT, -- Webhook event ID for idempotency

    -- Who triggered it
    triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for automated events

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- Usage Tracking (for future metered billing)
-- =====================================================

CREATE TABLE organization_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Current Month Usage
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Metrics
    projects_count INTEGER NOT NULL DEFAULT 0,
    environments_count INTEGER NOT NULL DEFAULT 0,
    variables_count INTEGER NOT NULL DEFAULT 0,
    team_members_count INTEGER NOT NULL DEFAULT 0,
    api_calls_count INTEGER NOT NULL DEFAULT 0, -- Future: API usage

    -- Metadata
    snapshot_data JSONB DEFAULT '{}'::jsonb, -- Store additional metrics

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(organization_id, period_start)
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_org_subscriptions_organization_id ON organization_subscriptions(organization_id);
CREATE INDEX idx_org_subscriptions_stripe_customer_id ON organization_subscriptions(stripe_customer_id);
CREATE INDEX idx_org_subscriptions_stripe_subscription_id ON organization_subscriptions(stripe_subscription_id);
CREATE INDEX idx_org_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX idx_org_subscriptions_trial_end ON organization_subscriptions(trial_end_date) WHERE trial_end_date IS NOT NULL;

CREATE INDEX idx_billing_events_organization_id ON billing_events(organization_id);
CREATE INDEX idx_billing_events_subscription_id ON billing_events(subscription_id);
CREATE INDEX idx_billing_events_created_at ON billing_events(created_at DESC);
CREATE INDEX idx_billing_events_stripe_event_id ON billing_events(stripe_event_id) WHERE stripe_event_id IS NOT NULL;

CREATE INDEX idx_organization_usage_organization_id ON organization_usage(organization_id);
CREATE INDEX idx_organization_usage_period ON organization_usage(period_start, period_end);

-- =====================================================
-- Triggers
-- =====================================================

CREATE TRIGGER update_subscription_plans_updated_at
    BEFORE UPDATE ON subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_subscriptions_updated_at
    BEFORE UPDATE ON organization_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_usage_updated_at
    BEFORE UPDATE ON organization_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;

-- Subscription Plans: Public read (everyone can see available plans)
CREATE POLICY "Anyone can view active subscription plans"
    ON subscription_plans FOR SELECT
    USING (is_active = true);

-- Organization Subscriptions: Members can view their org's subscription
CREATE POLICY "Organization members can view subscription"
    ON organization_subscriptions FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

-- Only service role can modify subscriptions (webhooks/admin only)
-- No INSERT/UPDATE/DELETE policies for regular users

-- Billing Events: Members can view their org's events
CREATE POLICY "Organization members can view billing events"
    ON billing_events FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

-- Usage: Members can view their org's usage
CREATE POLICY "Organization members can view usage"
    ON organization_usage FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get organization's current subscription
CREATE OR REPLACE FUNCTION get_organization_subscription(org_id UUID)
RETURNS organization_subscriptions
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT *
    FROM organization_subscriptions
    WHERE organization_id = org_id
    LIMIT 1;
$$;

-- Check if organization has active subscription (including trial)
CREATE OR REPLACE FUNCTION has_active_subscription(org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS(
        SELECT 1
        FROM organization_subscriptions
        WHERE organization_id = org_id
        AND status IN ('trialing', 'active', 'past_due', 'canceled')
    );
$$;

-- Get plan limits for organization
CREATE OR REPLACE FUNCTION get_organization_limits(org_id UUID)
RETURNS JSONB
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
    SELECT sp.limits
    FROM organization_subscriptions os
    JOIN subscription_plans sp ON os.plan_id = sp.id
    WHERE os.organization_id = org_id
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_organization_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_active_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_organization_limits(UUID) TO authenticated;

-- =====================================================
-- Seed Initial Plan Data
-- =====================================================

INSERT INTO subscription_plans (id, name, display_name, description, price_cents, billing_interval, limits, features, display_order) VALUES
(
    'free',
    'Free',
    'Free Plan',
    'Perfect for getting started',
    0,
    NULL,
    '{
        "projects": 3,
        "environments_per_project": 3,
        "variables_per_environment": 50,
        "team_members": 1,
        "audit_log_retention_days": 7
    }'::jsonb,
    '["basic_audit_logs"]'::jsonb,
    1
),
(
    'pro_monthly',
    'Pro',
    'Pro Monthly',
    'For professional teams',
    2900,
    'month',
    '{
        "projects": -1,
        "environments_per_project": -1,
        "variables_per_environment": -1,
        "team_members": 10,
        "audit_log_retention_days": 90
    }'::jsonb,
    '["unlimited_everything", "advanced_audit_logs", "priority_support"]'::jsonb,
    2
),
(
    'pro_annual',
    'Pro',
    'Pro Annual',
    'For professional teams (20% off)',
    27840,
    'year',
    '{
        "projects": -1,
        "environments_per_project": -1,
        "variables_per_environment": -1,
        "team_members": 10,
        "audit_log_retention_days": 365
    }'::jsonb,
    '["unlimited_everything", "advanced_audit_logs", "priority_support", "annual_discount"]'::jsonb,
    3
);

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE subscription_plans IS 'Master table of available subscription plans and their limits';
COMMENT ON TABLE organization_subscriptions IS 'One subscription record per organization tracking their current plan and Stripe state';
COMMENT ON TABLE billing_events IS 'Audit trail of all billing-related events for compliance and debugging';
COMMENT ON TABLE organization_usage IS 'Usage metrics for metered billing (future enhancement)';

COMMENT ON COLUMN subscription_plans.limits IS 'JSONB object defining resource limits. -1 means unlimited.';
COMMENT ON COLUMN organization_subscriptions.status IS 'Current subscription status synced from Stripe webhooks';
COMMENT ON COLUMN billing_events.stripe_event_id IS 'Used for webhook idempotency checks';
