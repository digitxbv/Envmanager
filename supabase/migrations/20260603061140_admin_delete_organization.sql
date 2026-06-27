-- =====================================================
-- Admin: Delete Organization
-- Description: Platform-admin-only hard delete of an organization and all
--              org-scoped data, including cleanup of integration vault secrets.
--              Does NOT delete user accounts (auth.users).
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

  -- ON DELETE CASCADE removes members, projects, environments, variables,
  -- environment_access, variable_audit_log, organization_subscriptions,
  -- billing_events, platform_integrations, github_installations, api_keys, etc.
  -- Variable vault secrets are cleaned by the existing AFTER DELETE ON variables trigger.
  DELETE FROM organizations WHERE id = p_org_id;

  RETURN v_org_name;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_delete_organization(UUID) TO authenticated;

COMMENT ON FUNCTION admin_delete_organization IS
  'Platform-admin-only: permanently deletes an organization and all org-scoped data, including cleanup of integration vault secrets. Does not delete user accounts.';
