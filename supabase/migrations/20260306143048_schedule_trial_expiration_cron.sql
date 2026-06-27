-- Schedule downgrade_expired_trials() to run every hour via pg_cron
-- The function already exists from migration 20251020181926_security_and_trial_fixes.sql
-- but was never scheduled, so expired trials were never downgraded.

-- Enable pg_cron extension (available on Supabase hosted by default)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Schedule: run every hour at minute 0
SELECT cron.schedule(
  'downgrade-expired-trials',
  '0 * * * *',
  'SELECT downgrade_expired_trials();'
);

-- Run immediately to fix any currently expired trials
SELECT downgrade_expired_trials();
