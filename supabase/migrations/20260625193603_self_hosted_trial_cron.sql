-- =====================================================
-- Self-hosted: make downgrade_expired_trials() a no-op
-- Description: When app.self_hosted='true' the trial-expiration cron must not
--              lock any workspace (self-hosted has no trials/billing). The cron
--              schedule is left untouched; the function early-returns.
-- SaaS-safe: when app.self_hosted is unset the guard is false and the existing
--            lock-on-expiry behaviour runs unchanged (matches
--            20260611203438_remove_free_plan_add_lock.sql).
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
  -- Self-hosted instances have no billing/trials — nothing to expire.
  IF current_setting('app.self_hosted', true) = 'true' THEN
    RETURN;
  END IF;

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
