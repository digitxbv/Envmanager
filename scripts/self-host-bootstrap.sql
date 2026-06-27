-- =====================================================
-- EnvManager self-host bootstrap
-- Runs once after migrations, on first boot. Idempotent.
-- =====================================================

-- 1. Persist the self-hosted flag at the database level so SQL/RLS/RPCs can read
--    it via current_setting('app.self_hosted', true). This is the SQL-side twin
--    of the app's EM_SELF_HOSTED env var. Persists across restarts.
ALTER DATABASE postgres SET app.self_hosted = 'true';

-- Apply it to the current session immediately (ALTER DATABASE only takes effect
-- on new connections) so any verification in this same job sees it.
SET app.self_hosted = 'true';

-- 2. Sanity check: the flag must read back as the string 'true'.
DO $$
BEGIN
  IF current_setting('app.self_hosted', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'self_hosted flag not set correctly';
  END IF;
  RAISE NOTICE 'app.self_hosted = %', current_setting('app.self_hosted', true);
END $$;

-- 3. NOTE (single-org / invite-only / unlimited-limits / cron-no-op) is enforced
--    by the APP and by plan-limit RPCs reading this flag — that gating is
--    Plan ② work, not this compose plan. No org row is seeded here: the first
--    registered user creates the single org through the normal onboarding flow.
