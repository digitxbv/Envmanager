-- =====================================================
-- SERVICES LAYER — Multi-Service Variable Management
-- Migration: 20260225120000_add_services_layer.sql
-- Description: Add services table, service_id to variables/integration configs/auto-sync,
--              update RPCs, fix vault trigger, add RLS policies
-- =====================================================

-- =====================================================
-- 1. Create services table
-- =====================================================

CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(project_id, name)
);

CREATE INDEX idx_services_project ON services(project_id);
CREATE INDEX idx_services_organization ON services(organization_id);

-- Reuse existing updated_at trigger
CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. Add service_id to variables
-- =====================================================

ALTER TABLE variables ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE SET NULL;
CREATE INDEX idx_variables_service ON variables(service_id);

-- Replace unique constraint: drop old, create partial unique indexes
ALTER TABLE variables DROP CONSTRAINT variables_environment_id_key_key;

-- Variables with a service: unique per (env, key, service)
CREATE UNIQUE INDEX idx_variables_env_key_service
    ON variables(environment_id, key, service_id)
    WHERE service_id IS NOT NULL;

-- Variables without a service (shared): unique per (env, key)
CREATE UNIQUE INDEX idx_variables_env_key_no_service
    ON variables(environment_id, key)
    WHERE service_id IS NULL;

-- =====================================================
-- 3. Add service_id to environment_integration_configs
-- =====================================================

ALTER TABLE environment_integration_configs
    ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE SET NULL;

-- Replace unique constraint with partial unique indexes
ALTER TABLE environment_integration_configs
    DROP CONSTRAINT IF EXISTS environment_integration_confi_environment_id_project_integr_key;

CREATE UNIQUE INDEX idx_env_int_configs_with_service
    ON environment_integration_configs(environment_id, project_integration_id, service_id)
    WHERE service_id IS NOT NULL;

CREATE UNIQUE INDEX idx_env_int_configs_no_service
    ON environment_integration_configs(environment_id, project_integration_id)
    WHERE service_id IS NULL;

-- =====================================================
-- 4. Add service_id to platform_auto_sync_queue
-- =====================================================

ALTER TABLE platform_auto_sync_queue
    ADD COLUMN service_id UUID REFERENCES services(id) ON DELETE SET NULL;

-- Update queue_platform_auto_sync() to carry service_id
CREATE OR REPLACE FUNCTION queue_platform_auto_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config RECORD;
    v_environment_id UUID;
    v_service_id UUID;
BEGIN
    -- Determine environment_id and service_id from the variable change
    v_environment_id := COALESCE(NEW.environment_id, OLD.environment_id);
    v_service_id := COALESCE(NEW.service_id, OLD.service_id);

    -- Find environment integration configs with auto_sync enabled for this environment
    FOR v_config IN
        SELECT eic.id as env_config_id, pi.platform
        FROM environment_integration_configs eic
        JOIN platform_integrations pi ON pi.id = eic.project_integration_id
        WHERE eic.environment_id = v_environment_id
          AND eic.enabled = true
          AND pi.disconnected_at IS NULL
          AND (eic.target_config->>'auto_sync')::boolean = true
    LOOP
        INSERT INTO platform_auto_sync_queue (
            env_config_id,
            platform,
            change_type,
            variable_key,
            service_id,
            queued_at
        ) VALUES (
            v_config.env_config_id,
            v_config.platform,
            TG_OP,
            COALESCE(NEW.key, OLD.key),
            v_service_id,
            now()
        )
        ON CONFLICT (env_config_id)
        DO UPDATE SET
            change_type = EXCLUDED.change_type,
            variable_key = EXCLUDED.variable_key,
            service_id = EXCLUDED.service_id,
            queued_at = now(),
            processed_at = NULL;
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Must drop first — return type changes (adding service_id)
DROP FUNCTION IF EXISTS get_pending_platform_syncs(INTEGER);

CREATE OR REPLACE FUNCTION get_pending_platform_syncs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    queue_id UUID,
    sync_config_id UUID,
    platform TEXT,
    change_type TEXT,
    variable_key TEXT,
    queued_at TIMESTAMPTZ,
    service_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        q.id as queue_id,
        q.env_config_id as sync_config_id,
        q.platform,
        q.change_type,
        q.variable_key,
        q.queued_at,
        q.service_id
    FROM platform_auto_sync_queue q
    WHERE q.processed_at IS NULL
    ORDER BY q.queued_at ASC
    LIMIT p_limit;
$$;

-- =====================================================
-- 5. Update get_variables_for_sync RPC
-- =====================================================

-- Must drop first — return type changes (adding service_id)
-- Drop both overloads: original 3-param and 4-param with fallbacks
DROP FUNCTION IF EXISTS get_variables_for_sync(UUID, BOOLEAN, BOOLEAN);
DROP FUNCTION IF EXISTS get_variables_for_sync(UUID, BOOLEAN, BOOLEAN, BOOLEAN);

CREATE OR REPLACE FUNCTION get_variables_for_sync(
    p_environment_id UUID,
    p_sync_secrets BOOLEAN DEFAULT true,
    p_sync_variables BOOLEAN DEFAULT true,
    p_include_fallbacks BOOLEAN DEFAULT false,
    p_service_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    key TEXT,
    value TEXT,
    is_secret BOOLEAN,
    fallback_value TEXT,
    tags TEXT[],
    service_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
    RETURN QUERY
    SELECT
        v.id,
        v.key,
        CASE
            WHEN v.is_secret THEN
                CASE
                    WHEN p_include_fallbacks
                         AND (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = v.vault_secret_id) IS NULL
                         AND v.fallback_value IS NOT NULL
                    THEN v.fallback_value
                    ELSE (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = v.vault_secret_id)
                END
            ELSE
                CASE
                    WHEN p_include_fallbacks
                         AND (v.value IS NULL OR v.value = '')
                         AND v.fallback_value IS NOT NULL
                    THEN v.fallback_value
                    ELSE v.value
                END
        END AS value,
        v.is_secret,
        v.fallback_value,
        v.tags,
        v.service_id
    FROM variables v
    WHERE v.environment_id = p_environment_id
      AND (
          (v.is_secret = true AND p_sync_secrets = true)
          OR
          (v.is_secret = false AND p_sync_variables = true)
      )
      AND (
          p_service_id IS NULL
          OR v.service_id = p_service_id
          OR v.service_id IS NULL
      )
    ORDER BY v.key;
END;
$$;

-- =====================================================
-- 6. Update bulk_insert_variables RPC
-- =====================================================

-- Must drop first — parameter list changes
DROP FUNCTION IF EXISTS bulk_insert_variables(JSONB, UUID, UUID, BOOLEAN);

CREATE OR REPLACE FUNCTION bulk_insert_variables(
  variables_data JSONB,
  environment_id_param UUID,
  organization_id_param UUID,
  import_as_secrets BOOLEAN DEFAULT false,
  service_id_param UUID DEFAULT NULL
)
RETURNS SETOF variables
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  var_item JSONB;
  new_var variables%ROWTYPE;
BEGIN
  -- Verify access
  IF NOT EXISTS (
    SELECT 1 FROM environment_access ea
    JOIN environments e ON e.id = ea.environment_id
    WHERE ea.environment_id = environment_id_param
    AND ea.user_id = auth.uid()
    AND e.organization_id = organization_id_param
    AND e.organization_id IN (SELECT get_user_organization_ids())
  ) THEN
    RAISE EXCEPTION 'Access denied to environment or organization';
  END IF;

  -- Validate service belongs to the right project if provided
  IF service_id_param IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM services s
      JOIN environments e ON e.project_id = s.project_id
      WHERE s.id = service_id_param
      AND e.id = environment_id_param
    ) THEN
      RAISE EXCEPTION 'Service does not belong to this project';
    END IF;
  END IF;

  FOR var_item IN SELECT * FROM jsonb_array_elements(variables_data)
  LOOP
    INSERT INTO variables (
      key,
      value,
      is_secret,
      environment_id,
      organization_id,
      fallback_value,
      service_id
    ) VALUES (
      var_item->>'key',
      var_item->>'value',
      import_as_secrets,
      environment_id_param,
      organization_id_param,
      (var_item->>'fallback_value')::TEXT,
      service_id_param
    )
    RETURNING * INTO new_var;
    RETURN NEXT new_var;
  END LOOP;
END;
$$;

-- =====================================================
-- 7. Fix vault trigger — service-aware secret names
-- =====================================================

CREATE OR REPLACE FUNCTION create_vault_secret_for_variable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  secret_uuid UUID;
  secret_name TEXT;
BEGIN
  IF NEW.is_secret = false THEN
    IF OLD.is_secret = true AND OLD.vault_secret_id IS NOT NULL THEN
      DELETE FROM vault.secrets WHERE id = OLD.vault_secret_id;
      NEW.vault_secret_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.is_secret = true
    AND NEW.is_secret = true
    AND (NEW.value IS NULL OR NEW.value = '') THEN
    IF OLD.vault_secret_id IS NULL THEN
      RAISE EXCEPTION 'Secret variable missing vault reference';
    END IF;

    NEW.vault_secret_id := OLD.vault_secret_id;
    NEW.value := NULL;
    RETURN NEW;
  END IF;

  IF NEW.value IS NULL OR NEW.value = '' THEN
    RAISE EXCEPTION 'Secret variables cannot have empty values';
  END IF;

  -- Include service_id in secret name to prevent collisions across services
  secret_name := 'variable_' || NEW.environment_id::TEXT || '_' || COALESCE(NEW.service_id::TEXT, 'shared') || '_' || NEW.key;

  IF TG_OP = 'UPDATE' AND OLD.vault_secret_id IS NOT NULL THEN
    BEGIN
      PERFORM vault.update_secret(
        OLD.vault_secret_id,
        NEW.value,
        secret_name,
        'Environment: ' || NEW.environment_id::TEXT || ', Service: ' || COALESCE(NEW.service_id::TEXT, 'shared') || ', Key: ' || NEW.key
      );
      NEW.vault_secret_id := OLD.vault_secret_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to update vault secret: %', SQLERRM;
    END;
  ELSE
    secret_uuid := vault.create_secret(
      NEW.value,
      secret_name,
      'Environment: ' || NEW.environment_id::TEXT || ', Service: ' || COALESCE(NEW.service_id::TEXT, 'shared') || ', Key: ' || NEW.key
    );
    NEW.vault_secret_id := secret_uuid;
  END IF;

  NEW.value := NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION create_vault_secret_for_variable() IS
  'Automatically creates/updates Vault secrets for variables marked as is_secret=true. Service-aware secret naming prevents collisions across services.';

-- =====================================================
-- 8. RLS policies for services table
-- =====================================================

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- SELECT: org membership
CREATE POLICY "Users can view services in their organizations"
    ON services FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

-- INSERT: admin/owner only
CREATE POLICY "Admins can create services"
    ON services FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (SELECT get_user_organization_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = services.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- UPDATE: admin/owner only
CREATE POLICY "Admins can update services"
    ON services FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = services.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- DELETE: admin/owner only
CREATE POLICY "Admins can delete services"
    ON services FOR DELETE
    TO authenticated
    USING (
        organization_id IN (SELECT get_user_organization_ids())
        AND EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = services.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON services TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE services IS 'Services within a project — enables multi-service variable scoping (namespace model)';
COMMENT ON COLUMN variables.service_id IS 'Optional service scope — NULL means shared/global variable';
COMMENT ON COLUMN environment_integration_configs.service_id IS 'Optional service scope for integration sync — NULL syncs all variables';
COMMENT ON COLUMN platform_auto_sync_queue.service_id IS 'Service context from the variable change that triggered the sync';
