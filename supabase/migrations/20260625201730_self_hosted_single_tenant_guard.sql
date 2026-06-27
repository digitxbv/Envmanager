-- Migration: self_hosted_single_tenant_guard
--
-- Enforces single-tenant registration at the DB level for self-hosted instances.
-- This is defence-in-depth behind the UI gate: even if a second party calls the
-- GoTrue signUp endpoint directly, org creation will be rejected once the first
-- owner row exists in organization_members.
--
-- How it works:
--   - The FIRST org insert is always allowed because organization_members is empty
--     at that point (the owner row is inserted AFTER the org is created).
--   - Subsequent org inserts are blocked when app.self_hosted = 'true'.
--   - The invite flow is unaffected: accepting an invite inserts into
--     organization_members for the EXISTING org, never into organizations.
--   - SaaS deployments are unaffected: the GUC app.self_hosted is not set, so
--     current_setting() returns '' and the condition is false.
--
-- Activation: set app.self_hosted = 'true' in postgresql.conf or via ALTER DATABASE
--   for self-hosted deployments. EM_SELF_HOSTED env var in the app layer should
--   mirror this setting.

CREATE OR REPLACE FUNCTION enforce_single_tenant_self_hosted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.self_hosted', true) = 'true'
     AND EXISTS (SELECT 1 FROM organization_members)
  THEN
    RAISE EXCEPTION 'Self-hosted instances are single-tenant; registration is invite-only after the first user.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION enforce_single_tenant_self_hosted() IS
  'Blocks new-org creation on self-hosted instances once any organization_members row exists. '
  'Set GUC app.self_hosted=true in postgresql.conf/ALTER DATABASE to activate. '
  'Defence-in-depth behind the UI invite-only gate (closes direct GoTrue signUp bypass).';

DROP TRIGGER IF EXISTS trg_enforce_single_tenant_self_hosted ON organizations;

CREATE TRIGGER trg_enforce_single_tenant_self_hosted
  BEFORE INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_tenant_self_hosted();

COMMENT ON TRIGGER trg_enforce_single_tenant_self_hosted ON organizations IS
  'Enforces EM_SELF_HOSTED single-tenant rule at DB level. See enforce_single_tenant_self_hosted().';
