-- =====================================================
-- PLATFORM INTEGRATIONS
-- Migration: 20260119163237_platform_integrations.sql
-- Description: Generic platform integration schema for Vercel, Railway, Render, Dokploy, Coolify
-- =====================================================

-- =====================================================
-- Platform Integrations Table
-- Stores connection credentials for external platforms
-- =====================================================

CREATE TABLE platform_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('vercel', 'railway', 'render', 'dokploy', 'coolify')),
    name TEXT NOT NULL,                          -- User-defined connection name
    instance_url TEXT,                           -- For self-hosted (Dokploy, Coolify)
    skip_ssl_verify BOOLEAN DEFAULT false,       -- For self-signed certs
    api_token_vault_id UUID,                     -- Reference to Vault secret
    token_valid BOOLEAN,
    token_validated_at TIMESTAMPTZ,
    token_error TEXT,
    connected_by UUID NOT NULL REFERENCES auth.users(id),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    disconnected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One active connection per platform per org (null disconnected_at = active)
    UNIQUE(organization_id, platform, disconnected_at)
);

-- =====================================================
-- Platform Sync Configs Table
-- Links EnvManager projects to platform targets (one per project)
-- =====================================================

CREATE TABLE platform_sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES platform_integrations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    target JSONB NOT NULL DEFAULT '{}',          -- Platform-specific target info (includes environment mappings)
    auto_sync BOOLEAN NOT NULL DEFAULT false,
    sync_secrets BOOLEAN NOT NULL DEFAULT true,
    sync_variables BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    last_status TEXT CHECK (last_status IN ('success', 'partial', 'failed')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One config per project per connection
    UNIQUE(connection_id, project_id)
);

-- =====================================================
-- Platform Sync History Table
-- Audit trail of sync operations
-- =====================================================

CREATE TABLE platform_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_config_id UUID NOT NULL REFERENCES platform_sync_configs(id) ON DELETE CASCADE,
    triggered_by UUID NOT NULL REFERENCES auth.users(id),
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto', 'manual')),
    variables_synced INTEGER NOT NULL DEFAULT 0,
    secrets_synced INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    error_message TEXT,
    details JSONB,                               -- Synced keys, errors array
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_platform_integrations_org ON platform_integrations(organization_id);
CREATE INDEX idx_platform_integrations_platform ON platform_integrations(platform);
CREATE INDEX idx_platform_integrations_active ON platform_integrations(organization_id)
    WHERE disconnected_at IS NULL;
CREATE INDEX idx_platform_sync_configs_connection ON platform_sync_configs(connection_id);
CREATE INDEX idx_platform_sync_configs_project ON platform_sync_configs(project_id);
CREATE INDEX idx_platform_sync_history_config ON platform_sync_history(sync_config_id);
CREATE INDEX idx_platform_sync_history_created ON platform_sync_history(created_at DESC);

-- =====================================================
-- Updated_at Triggers
-- =====================================================

CREATE TRIGGER update_platform_integrations_updated_at
    BEFORE UPDATE ON platform_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_sync_configs_updated_at
    BEFORE UPDATE ON platform_sync_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE platform_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_sync_history ENABLE ROW LEVEL SECURITY;

-- platform_integrations: Org members can view
CREATE POLICY "Users can view integrations in their org"
    ON platform_integrations FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid()
        )
    );

-- platform_integrations: Only owners/admins can insert
CREATE POLICY "Admins can insert integrations"
    ON platform_integrations FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- platform_integrations: Only owners/admins can update
CREATE POLICY "Admins can update integrations"
    ON platform_integrations FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- platform_integrations: Only owners/admins can delete
CREATE POLICY "Admins can delete integrations"
    ON platform_integrations FOR DELETE
    TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- platform_sync_configs: Org members can view via connection
CREATE POLICY "Users can view sync configs via connection"
    ON platform_sync_configs FOR SELECT
    TO authenticated
    USING (
        connection_id IN (
            SELECT id FROM platform_integrations
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- platform_sync_configs: Only owners/admins can manage
CREATE POLICY "Admins can manage sync configs"
    ON platform_sync_configs FOR ALL
    TO authenticated
    USING (
        connection_id IN (
            SELECT id FROM platform_integrations
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    )
    WITH CHECK (
        connection_id IN (
            SELECT id FROM platform_integrations
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- platform_sync_history: Org members can view via config -> connection
CREATE POLICY "Users can view sync history via config"
    ON platform_sync_history FOR SELECT
    TO authenticated
    USING (
        sync_config_id IN (
            SELECT id FROM platform_sync_configs
            WHERE connection_id IN (
                SELECT id FROM platform_integrations
                WHERE organization_id IN (
                    SELECT organization_id FROM organization_members
                    WHERE user_id = auth.uid()
                )
            )
        )
    );

-- platform_sync_history: Only service role can insert (from edge functions)
-- No direct INSERT policy for authenticated users

-- =====================================================
-- Helper RPC Functions (for Edge Functions)
-- =====================================================

-- Get vault secret (for Edge Functions to retrieve API tokens)
CREATE OR REPLACE FUNCTION get_vault_secret(secret_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
BEGIN
    RETURN (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE id = secret_id
    );
END;
$$;

-- Get variables for sync (with decryption)
-- Note: Uses 'variables' table (not 'environment_variables')
CREATE OR REPLACE FUNCTION get_variables_for_sync(
    p_environment_id UUID,
    p_sync_secrets BOOLEAN DEFAULT true,
    p_sync_variables BOOLEAN DEFAULT true
)
RETURNS TABLE (
    id UUID,
    key TEXT,
    value TEXT,
    is_secret BOOLEAN
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
                (SELECT ds.decrypted_secret FROM vault.decrypted_secrets ds WHERE ds.id = v.vault_secret_id)
            ELSE
                v.value
        END AS value,
        v.is_secret
    FROM variables v
    WHERE v.environment_id = p_environment_id
      AND (
          (v.is_secret = true AND p_sync_secrets = true)
          OR
          (v.is_secret = false AND p_sync_variables = true)
      )
    ORDER BY v.key;
END;
$$;

-- Create platform integration (stores token in vault)
CREATE OR REPLACE FUNCTION create_platform_integration(
    p_organization_id UUID,
    p_platform TEXT,
    p_name TEXT,
    p_api_token TEXT,
    p_instance_url TEXT DEFAULT NULL,
    p_skip_ssl_verify BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_vault_id UUID;
    v_integration_id UUID;
BEGIN
    -- Check user has admin/owner role in organization
    IF NOT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_organization_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied: requires owner or admin role';
    END IF;

    -- Store token in vault
    INSERT INTO vault.secrets (secret, name)
    VALUES (
        p_api_token,
        format('%s_%s_%s_token', p_organization_id, p_platform, extract(epoch from now())::bigint)
    )
    RETURNING id INTO v_vault_id;

    -- Create integration record
    INSERT INTO platform_integrations (
        organization_id,
        platform,
        name,
        instance_url,
        skip_ssl_verify,
        api_token_vault_id,
        token_valid,
        token_validated_at,
        connected_by
    )
    VALUES (
        p_organization_id,
        p_platform,
        p_name,
        p_instance_url,
        p_skip_ssl_verify,
        v_vault_id,
        true,
        now(),
        auth.uid()
    )
    RETURNING id INTO v_integration_id;

    RETURN v_integration_id;
END;
$$;

-- Record a platform sync operation (called from edge function)
CREATE OR REPLACE FUNCTION record_platform_sync(
    p_sync_config_id UUID,
    p_triggered_by UUID,
    p_trigger_type TEXT,
    p_variables_synced INTEGER,
    p_secrets_synced INTEGER,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
)
RETURNS platform_sync_history
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_history platform_sync_history;
BEGIN
    -- Insert history record
    INSERT INTO platform_sync_history (
        sync_config_id,
        triggered_by,
        trigger_type,
        variables_synced,
        secrets_synced,
        status,
        error_message,
        details
    ) VALUES (
        p_sync_config_id,
        p_triggered_by,
        p_trigger_type,
        p_variables_synced,
        p_secrets_synced,
        p_status,
        p_error_message,
        p_details
    )
    RETURNING * INTO v_history;

    -- Update sync config with latest status
    UPDATE platform_sync_configs
    SET
        last_synced_at = now(),
        last_status = p_status,
        last_error = p_error_message
    WHERE id = p_sync_config_id;

    RETURN v_history;
END;
$$;

-- =====================================================
-- Grants
-- =====================================================

GRANT SELECT ON platform_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_sync_configs TO authenticated;
GRANT SELECT ON platform_sync_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_vault_secret TO service_role;
GRANT EXECUTE ON FUNCTION get_variables_for_sync TO service_role;
GRANT EXECUTE ON FUNCTION create_platform_integration TO authenticated;
GRANT EXECUTE ON FUNCTION record_platform_sync TO service_role;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE platform_integrations IS 'Platform connections for syncing env vars to Vercel, Railway, Render, Dokploy, Coolify';
COMMENT ON TABLE platform_sync_configs IS 'Configuration for syncing EnvManager projects to platform targets (one per project)';
COMMENT ON TABLE platform_sync_history IS 'Audit log of platform sync operations';
COMMENT ON FUNCTION get_vault_secret IS 'Retrieves decrypted API token from Vault (service role only)';
COMMENT ON FUNCTION get_variables_for_sync IS 'Returns decrypted variables for platform sync (service role only)';
COMMENT ON FUNCTION create_platform_integration IS 'Creates platform integration with token stored in Vault';
COMMENT ON FUNCTION record_platform_sync IS 'Records sync history and updates config status (service role only)';
