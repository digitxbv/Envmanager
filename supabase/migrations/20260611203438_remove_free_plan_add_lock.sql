-- =====================================================
-- Remove Free Plan & Add Lock State
-- Migration: 20260611203438_remove_free_plan_add_lock.sql
-- Description: Removes the free plan from active use.
--   - Expired trials → status='paused' (locked) instead of downgrade to free
--   - Stripe subscription deleted → status='paused' (locked) instead of downgrade to free
--   - Deactivates the free row in subscription_plans (kept for FK integrity)
--   - Backfills existing free/expired-trial subs to paused
-- =====================================================

-- =====================================================
-- 1. Update downgrade_expired_trials() to lock instead of downgrade
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
      AND stripe_subscription_id IS NULL -- only unpaid trials
  LOOP
    -- Lock the org instead of downgrading to free
    UPDATE organization_subscriptions
    SET
      status = 'paused'
    WHERE organization_id = expired_subscription.organization_id;

    -- Log the lock event
    INSERT INTO billing_events (
      organization_id,
      event_type,
      from_plan_id,
      details
    ) VALUES (
      expired_subscription.organization_id,
      'trial_ended',
      expired_subscription.plan_id,
      jsonb_build_object(
        'reason', 'trial_expired_locked',
        'locked_at', NOW()
      )
    );
  END LOOP;

  -- Log summary
  RAISE NOTICE 'Locked % expired trials', (
    SELECT COUNT(*)
    FROM organization_subscriptions
    WHERE status = 'paused'
  );
END;
$$;

-- =====================================================
-- 2. Backfill existing data
-- =====================================================

-- Any sub still on the free plan gets locked on pro_monthly
UPDATE organization_subscriptions
SET plan_id = 'pro_monthly', status = 'paused'
WHERE plan_id = 'free';

-- Any trialing sub whose trial has expired (no Stripe sub) gets locked
UPDATE organization_subscriptions
SET status = 'paused'
WHERE status = 'trialing'
  AND trial_end_date < NOW()
  AND stripe_subscription_id IS NULL;

-- =====================================================
-- 3. Deactivate free plan (keep row for FK integrity)
-- =====================================================

UPDATE subscription_plans
SET is_active = false, updated_at = NOW()
WHERE id = 'free';