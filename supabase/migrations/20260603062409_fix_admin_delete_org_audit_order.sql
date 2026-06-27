-- =====================================================
-- Fix: admin_delete_organization audit-log ordering
-- Supersedes the function defined in 20260603061140_admin_delete_organization.sql.
--
-- Problem: deleting the organization row cascades to `variables`, whose
-- AFTER DELETE trigger (log_variable_change) inserts a `variable_audit_log` row
-- referencing organization_id (NOT NULL, FK -> organizations). During the cascade
-- the organization is already gone, so the audit insert fails with
-- "variable_audit_log_organization_id_fkey" (23503) and the whole delete rolls back.
--
-- Fix: delete the org's `variables` first — while the organization (and its
-- environments) still exist — so the audit/sync AFTER DELETE inserts get valid
-- FKs (and the vault-secret cleanup trigger still runs). The subsequent
-- organization delete then cascades those audit rows away.
-- =====================================================

CREATE OR REPLACE FUNCTION admin_delete_organization(p_org_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_org_name TEXT;
BEGIN
  IF NOT (SELECT is_platform_admin()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT name INTO v_org_name FROM organizations WHERE id = p_org_id;
  IF v_org_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Integration tokens are stored in vault.secrets but referenced by plain UUID
  -- columns with no FK cascade and no delete trigger, so clean them up explicitly.
  DELETE FROM vault.secrets
  WHERE id IN (
    SELECT api_token_vault_id FROM platform_integrations
      WHERE organization_id = p_org_id AND api_token_vault_id IS NOT NULL
    UNION
    SELECT ca_cert_vault_id FROM platform_integrations
      WHERE organization_id = p_org_id AND ca_cert_vault_id IS NOT NULL
  );

  -- Delete variables FIRST, while the organization and its environments still
  -- exist, so the AFTER DELETE triggers on variables (audit log + sync enqueue)
  -- insert rows with valid foreign keys, and secret-variable vault secrets are
  -- cleaned by the existing cleanup trigger. The organization delete below then
  -- cascades these rows away.
  DELETE FROM variables WHERE organization_id = p_org_id;

  -- ON DELETE CASCADE removes members, projects, environments, environment_access,
  -- variable_audit_log, organization_subscriptions, billing_events,
  -- platform_integrations, github_installations, api_keys, etc.
  DELETE FROM organizations WHERE id = p_org_id;

  RETURN v_org_name;
END;
$$;

COMMENT ON FUNCTION admin_delete_organization IS
  'Platform-admin-only: permanently deletes an organization and all org-scoped data, including cleanup of integration vault secrets. Deletes variables first to satisfy audit-log FKs. Does not delete user accounts.';
