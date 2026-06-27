-- =====================================================
-- Security and Trial Fixes Migration
-- =====================================================
-- Fixes critical security issues and trial logic inconsistencies

-- =====================================================
-- 1. Add Explicit RLS Policies (Defense in Depth)
-- =====================================================

-- Add explicit DENY policies for subscription modifications
-- This ensures only service role can modify subscriptions
-- even if permissive policies are added in the future

CREATE POLICY "Users cannot insert subscriptions"
    ON organization_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (false);

CREATE POLICY "Users cannot update subscriptions"
    ON organization_subscriptions FOR UPDATE
    TO authenticated
    USING (false);

CREATE POLICY "Users cannot delete subscriptions"
    ON organization_subscriptions FOR DELETE
    TO authenticated
    USING (false);

-- =====================================================
-- 2. Fix Trial Logic - Use Pro Plan During Trial
-- =====================================================

-- Update the trigger to create trials on pro_monthly plan
-- This gives users access to Pro features during the trial
CREATE OR REPLACE FUNCTION create_free_subscription_for_org()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  trial_end_timestamp TIMESTAMPTZ;
BEGIN
  -- Calculate trial end date (14 days from now)
  trial_end_timestamp := NOW() + INTERVAL '14 days';

  -- Create subscription with Pro trial
  INSERT INTO organization_subscriptions (
    organization_id,
    plan_id,
    status,
    trial_start_date,
    trial_end_date,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'pro_monthly', -- Changed from 'free' to give Pro features during trial
    'trialing',
    NOW(),
    trial_end_timestamp,
    NOW(),
    trial_end_timestamp
  );

  -- Log the trial creation
  INSERT INTO billing_events (
    organization_id,
    event_type,
    to_plan_id,
    triggered_by,
    details
  ) VALUES (
    NEW.id,
    'trial_started',
    'pro_monthly',
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    jsonb_build_object(
      'trial_days', 14,
      'created_at', NOW()
    )
  );

  RETURN NEW;
END;
$$;

-- Update existing free trialing subscriptions to pro_monthly
UPDATE organization_subscriptions
SET plan_id = 'pro_monthly'
WHERE plan_id = 'free'
  AND status = 'trialing'
  AND trial_end_date > NOW();

-- =====================================================
-- 3. Add Function to Downgrade Expired Trials
-- =====================================================

CREATE OR REPLACE FUNCTION downgrade_expired_trials()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  expired_subscription RECORD;
BEGIN
  -- Find all expired trials without paid subscriptions
  FOR expired_subscription IN
    SELECT organization_id, plan_id
    FROM organization_subscriptions
    WHERE status = 'trialing'
      AND trial_end_date < NOW()
      AND stripe_subscription_id IS NULL -- Only free trials, not paid trials
  LOOP
    -- Downgrade to free plan
    UPDATE organization_subscriptions
    SET
      plan_id = 'free',
      status = 'active',
      trial_start_date = NULL,
      trial_end_date = NULL,
      current_period_start = NULL,
      current_period_end = NULL
    WHERE organization_id = expired_subscription.organization_id;

    -- Log the downgrade event
    INSERT INTO billing_events (
      organization_id,
      event_type,
      from_plan_id,
      to_plan_id,
      details
    ) VALUES (
      expired_subscription.organization_id,
      'trial_ended',
      expired_subscription.plan_id,
      'free',
      jsonb_build_object(
        'reason', 'trial_expired',
        'downgraded_at', NOW()
      )
    );
  END LOOP;

  -- Log summary
  RAISE NOTICE 'Downgraded % expired trials', (
    SELECT COUNT(*)
    FROM organization_subscriptions
    WHERE status = 'active'
      AND plan_id = 'free'
      AND trial_start_date IS NULL
  );
END;
$$;

-- =====================================================
-- 4. Add Index for Trial Expiration Queries
-- =====================================================

-- This index speeds up the expired trial check
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_status
ON organization_subscriptions (status, trial_end_date)
WHERE status = 'trialing';

-- =====================================================
-- 5. Add Table for Failed Webhooks (Observability)
-- =====================================================

CREATE TABLE IF NOT EXISTS failed_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    error_message TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for debugging
CREATE INDEX idx_failed_webhooks_created_at ON failed_webhooks (created_at DESC);
CREATE INDEX idx_failed_webhooks_event_type ON failed_webhooks (event_type);

-- Enable RLS
ALTER TABLE failed_webhooks ENABLE ROW LEVEL SECURITY;

-- Only service role can access (for debugging)
CREATE POLICY "Only service role can access failed webhooks"
    ON failed_webhooks FOR ALL
    TO authenticated
    USING (false);

-- =====================================================
-- 6. Run Initial Trial Downgrade
-- =====================================================

-- Downgrade any expired trials immediately
SELECT downgrade_expired_trials();

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. After this migration, set up a cron job to call downgrade_expired_trials()
--    Example with pg_cron (if enabled):
--    SELECT cron.schedule('downgrade-expired-trials', '0 0 * * *', 'SELECT downgrade_expired_trials();');
--
-- 2. For Supabase Edge Functions, create a scheduled function:
--    - Create supabase/functions/scheduled-trial-expiration/index.ts
--    - Set up cron trigger in Supabase Dashboard
--
-- 3. The failed_webhooks table helps with debugging webhook issues
--    Query with: SELECT * FROM failed_webhooks ORDER BY created_at DESC;
