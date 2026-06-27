-- Fix trial subscriptions to use 'pro_monthly' plan instead of 'free'
-- Bug: Trial was created with plan_id='free' but status='trialing',
-- so users got free limits instead of pro limits during trial

BEGIN;

-- 1. Update existing trialing subscriptions from 'free' to 'pro_monthly'
UPDATE organization_subscriptions
SET plan_id = 'pro_monthly'
WHERE status = 'trialing'
  AND plan_id IN ('free', 'pro');

-- 2. Fix the trigger function to create pro subscriptions for trials
CREATE OR REPLACE FUNCTION create_free_subscription_for_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO organization_subscriptions (
        organization_id,
        plan_id,
        status,
        trial_start_date,
        trial_end_date
    ) VALUES (
        NEW.id,
        'pro_monthly',
        'trialing',
        NOW(),
        NOW() + INTERVAL '14 days'
    );

    INSERT INTO billing_events (
        organization_id,
        event_type,
        to_plan_id,
        details,
        triggered_by
    ) VALUES (
        NEW.id,
        'trial_started',
        'pro_monthly',
        jsonb_build_object(
            'trial_days', 14,
            'auto_created', true
        ),
        auth.uid()
    );

    RETURN NEW;
END;
$$;

COMMIT;
