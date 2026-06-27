-- =====================================================
-- Self-hosted subscription support
-- Description:
--   1. is_first_user() — true when no users exist yet (registration bootstrap).
--   2. subscription_plans row 'self_hosted' — unlimited, never expires.
--   3. create_free_subscription_for_org() branches on app.self_hosted:
--        self-hosted  -> plan 'self_hosted', status 'active', NULL trial dates
--        SaaS (default) -> plan 'pro_monthly', status 'trialing', 14-day trial
-- SaaS-safe: when app.self_hosted is unset, current_setting(...) returns NULL,
--            so the SaaS branch runs exactly as before.
-- =====================================================

-- ---------------------------------------------------------------------------
-- 1. is_first_user(): used by the registration gate in self-hosted mode.
--    SECURITY DEFINER so an anon/unauthenticated caller can read the count
--    without exposing organization_members rows.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_first_user()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT NOT EXISTS (SELECT 1 FROM organization_members);
$$;

-- Allow both anonymous (pre-signup) and authenticated callers to check.
GRANT EXECUTE ON FUNCTION is_first_user() TO anon, authenticated;

COMMENT ON FUNCTION is_first_user() IS
'Returns true when no organization members exist yet. Used by the self-hosted registration gate to allow the very first admin to sign up; afterwards registration is invite-only.';

-- ---------------------------------------------------------------------------
-- 2. self_hosted plan row (unlimited everything, never expires).
--    INSERT ... ON CONFLICT DO UPDATE so re-running migrations is idempotent.
-- ---------------------------------------------------------------------------
INSERT INTO subscription_plans (
    id, name, display_name, description, price_cents, billing_interval, limits, features, display_order, is_active
) VALUES (
    'self_hosted',
    'Self-Hosted',
    'Self-Hosted',
    'Unlimited self-hosted instance',
    0,
    NULL,
    '{
        "projects": -1,
        "environments_per_project": -1,
        "variables_per_environment": -1,
        "team_members": -1,
        "audit_log_retention_days": -1
    }'::jsonb,
    '["unlimited_everything", "advanced_audit_logs", "self_hosted"]'::jsonb,
    0,
    true
)
ON CONFLICT (id) DO UPDATE SET
    limits = EXCLUDED.limits,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 3. Branch the org-subscription trigger function on app.self_hosted.
--    SaaS branch is byte-for-byte the current behaviour
--    (20260205130443_fix_trial_plan_id.sql).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_free_subscription_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF current_setting('app.self_hosted', true) = 'true' THEN
        -- Self-hosted: unlimited, active, no trial.
        INSERT INTO organization_subscriptions (
            organization_id, plan_id, status, trial_start_date, trial_end_date
        ) VALUES (
            NEW.id, 'self_hosted', 'active', NULL, NULL
        );

        INSERT INTO billing_events (
            organization_id, event_type, to_plan_id, details, triggered_by
        ) VALUES (
            NEW.id,
            'subscription_created',
            'self_hosted',
            jsonb_build_object('self_hosted', true, 'auto_created', true),
            auth.uid()
        );
    ELSE
        -- SaaS (default): 14-day Pro trial. Matches prior behaviour exactly.
        INSERT INTO organization_subscriptions (
            organization_id, plan_id, status, trial_start_date, trial_end_date
        ) VALUES (
            NEW.id, 'pro_monthly', 'trialing', NOW(), NOW() + INTERVAL '14 days'
        );

        INSERT INTO billing_events (
            organization_id, event_type, to_plan_id, details, triggered_by
        ) VALUES (
            NEW.id,
            'trial_started',
            'pro_monthly',
            jsonb_build_object('trial_days', 14, 'auto_created', true),
            auth.uid()
        );
    END IF;

    RETURN NEW;
END;
$$;
