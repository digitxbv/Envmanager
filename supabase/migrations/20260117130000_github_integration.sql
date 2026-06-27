-- =====================================================
-- GITHUB INTEGRATION
-- Migration: 20260117130000_github_integration.sql
-- Description: GitHub App integration for syncing secrets/variables to GitHub Actions
-- =====================================================

-- =====================================================
-- GitHub Installations Table
-- Stores GitHub App installations linked to EnvManager organizations
-- =====================================================

CREATE TABLE github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- GitHub Installation Data
    installation_id BIGINT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('User', 'Organization')),
    account_login TEXT NOT NULL,
    account_id BIGINT NOT NULL,

    -- Authentication (tokens stored encrypted or fetched on-demand via JWT)
    -- We don't store access tokens - they're fetched using the app's private key
    -- This is more secure as tokens expire in 1 hour

    -- Installation metadata
    permissions JSONB DEFAULT '{}',
    repository_selection TEXT CHECK (repository_selection IN ('all', 'selected')),

    -- Lifecycle
    installed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    installed_at TIMESTAMPTZ DEFAULT now(),
    suspended_at TIMESTAMPTZ,
    uninstalled_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- One installation per org (can reinstall after uninstall)
    CONSTRAINT unique_active_installation UNIQUE (organization_id, installation_id)
);

-- =====================================================
-- GitHub Sync Configurations Table
-- Defines how EnvManager environments sync to GitHub
-- =====================================================

CREATE TABLE github_sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,

    -- Target Configuration
    sync_level TEXT NOT NULL CHECK (sync_level IN ('repository', 'environment', 'organization')),
    repo_owner TEXT,
    repo_name TEXT,
    github_environment TEXT, -- For environment-level secrets

    -- Sync Behavior
    auto_sync BOOLEAN NOT NULL DEFAULT false,
    sync_secrets BOOLEAN NOT NULL DEFAULT true,
    sync_variables BOOLEAN NOT NULL DEFAULT true,
    sync_mode TEXT NOT NULL DEFAULT 'selected' CHECK (sync_mode IN ('all', 'selected')),
    -- When sync_mode = 'selected', only sync variables marked with sync_to_github = true

    -- Status Tracking
    last_synced_at TIMESTAMPTZ,
    last_sync_status TEXT CHECK (last_sync_status IN ('success', 'partial', 'failed')),
    last_sync_error TEXT,
    last_sync_count INTEGER DEFAULT 0,

    -- Audit
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- Constraints
    CONSTRAINT valid_repo_level CHECK (
        sync_level != 'repository' OR (repo_owner IS NOT NULL AND repo_name IS NOT NULL)
    ),
    CONSTRAINT valid_env_level CHECK (
        sync_level != 'environment' OR (repo_owner IS NOT NULL AND repo_name IS NOT NULL AND github_environment IS NOT NULL)
    ),
    CONSTRAINT unique_env_sync_config UNIQUE (environment_id, sync_level, repo_owner, repo_name, github_environment)
);

-- =====================================================
-- GitHub Sync History Table
-- Audit log of all sync operations
-- =====================================================

CREATE TABLE github_sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_config_id UUID NOT NULL REFERENCES github_sync_configs(id) ON DELETE CASCADE,

    -- Trigger info
    triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto', 'manual')),

    -- Results
    variables_synced INTEGER NOT NULL DEFAULT 0,
    secrets_synced INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
    error_message TEXT,
    details JSONB DEFAULT '{}', -- Store synced variable names, errors per variable, etc.

    -- Timing
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- Add sync_to_github column to variables table
-- Allows users to mark specific variables for GitHub sync
-- =====================================================

ALTER TABLE variables
ADD COLUMN IF NOT EXISTS sync_to_github BOOLEAN NOT NULL DEFAULT false;

-- =====================================================
-- Indexes
-- =====================================================

-- GitHub installations
CREATE INDEX idx_github_installations_org ON github_installations(organization_id);
CREATE INDEX idx_github_installations_installation_id ON github_installations(installation_id);
CREATE INDEX idx_github_installations_active ON github_installations(organization_id) 
    WHERE uninstalled_at IS NULL;

-- Sync configs
CREATE INDEX idx_github_sync_configs_environment ON github_sync_configs(environment_id);
CREATE INDEX idx_github_sync_configs_installation ON github_sync_configs(installation_id);
CREATE INDEX idx_github_sync_configs_auto_sync ON github_sync_configs(environment_id) 
    WHERE auto_sync = true;

-- Sync history
CREATE INDEX idx_github_sync_history_config ON github_sync_history(sync_config_id);
CREATE INDEX idx_github_sync_history_created ON github_sync_history(created_at DESC);

-- Variables sync flag
CREATE INDEX idx_variables_sync_to_github ON variables(environment_id) 
    WHERE sync_to_github = true;

-- =====================================================
-- Triggers
-- =====================================================

CREATE TRIGGER update_github_installations_updated_at
    BEFORE UPDATE ON github_installations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_sync_configs_updated_at
    BEFORE UPDATE ON github_sync_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_sync_history ENABLE ROW LEVEL SECURITY;

-- GitHub Installations: Org members can view
CREATE POLICY "Organization members can view GitHub installations"
    ON github_installations FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

-- GitHub Installations: Only owners/admins can manage (INSERT via edge function with service role)
-- No direct INSERT/UPDATE/DELETE - managed via edge functions

-- Sync Configs: Users with environment access can view
CREATE POLICY "Users can view sync configs for accessible environments"
    ON github_sync_configs FOR SELECT
    TO authenticated
    USING (
        environment_id IN (SELECT get_user_environment_ids())
    );

-- Sync Configs: Owners/admins can create/update/delete
CREATE POLICY "Admins can manage sync configs"
    ON github_sync_configs FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM environments e
            JOIN organization_members om ON e.organization_id = om.organization_id
            WHERE e.id = github_sync_configs.environment_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM environments e
            JOIN organization_members om ON e.organization_id = om.organization_id
            WHERE e.id = github_sync_configs.environment_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- Sync History: Users with environment access can view
CREATE POLICY "Users can view sync history for accessible environments"
    ON github_sync_history FOR SELECT
    TO authenticated
    USING (
        sync_config_id IN (
            SELECT id FROM github_sync_configs 
            WHERE environment_id IN (SELECT get_user_environment_ids())
        )
    );

-- Sync History: Only service role can insert (from edge function)
-- No direct INSERT policy for authenticated users

-- =====================================================
-- Helper Functions
-- =====================================================

-- Get active GitHub installation for an organization
CREATE OR REPLACE FUNCTION get_github_installation(p_organization_id UUID)
RETURNS github_installations
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT *
    FROM github_installations
    WHERE organization_id = p_organization_id
    AND uninstalled_at IS NULL
    AND suspended_at IS NULL
    ORDER BY installed_at DESC
    LIMIT 1;
$$;

-- Get sync configs for an environment
CREATE OR REPLACE FUNCTION get_environment_sync_configs(p_environment_id UUID)
RETURNS SETOF github_sync_configs
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT *
    FROM github_sync_configs
    WHERE environment_id = p_environment_id
    ORDER BY created_at;
$$;

-- Get variables to sync for an environment (respects sync_mode)
CREATE OR REPLACE FUNCTION get_variables_to_sync(
    p_environment_id UUID,
    p_sync_mode TEXT DEFAULT 'selected'
)
RETURNS TABLE (
    id UUID,
    key TEXT,
    value TEXT,
    is_secret BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
    -- Check user has access to environment
    IF NOT EXISTS (
        SELECT 1 FROM environment_access
        WHERE environment_id = p_environment_id
        AND user_id = auth.uid()
    ) AND NOT EXISTS (
        -- Owners/admins have implicit access
        SELECT 1 FROM environments e
        JOIN organization_members om ON e.organization_id = om.organization_id
        WHERE e.id = p_environment_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied to environment';
    END IF;

    RETURN QUERY
    SELECT 
        v.id,
        v.key,
        CASE 
            WHEN v.is_secret THEN decrypt_variable_value(v.id)
            ELSE v.value
        END as value,
        v.is_secret
    FROM variables v
    WHERE v.environment_id = p_environment_id
    AND (
        p_sync_mode = 'all' 
        OR (p_sync_mode = 'selected' AND v.sync_to_github = true)
    );
END;
$$;

-- Record a sync operation (called from edge function)
CREATE OR REPLACE FUNCTION record_github_sync(
    p_sync_config_id UUID,
    p_triggered_by UUID,
    p_trigger_type TEXT,
    p_variables_synced INTEGER,
    p_secrets_synced INTEGER,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
)
RETURNS github_sync_history
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_history github_sync_history;
    v_started_at TIMESTAMPTZ;
BEGIN
    v_started_at := now();

    -- Insert history record
    INSERT INTO github_sync_history (
        sync_config_id,
        triggered_by,
        trigger_type,
        variables_synced,
        secrets_synced,
        status,
        error_message,
        details,
        started_at,
        completed_at,
        duration_ms
    ) VALUES (
        p_sync_config_id,
        p_triggered_by,
        p_trigger_type,
        p_variables_synced,
        p_secrets_synced,
        p_status,
        p_error_message,
        p_details,
        v_started_at,
        now(),
        EXTRACT(EPOCH FROM (now() - v_started_at)) * 1000
    )
    RETURNING * INTO v_history;

    -- Update sync config with latest status
    UPDATE github_sync_configs
    SET 
        last_synced_at = now(),
        last_sync_status = p_status,
        last_sync_error = p_error_message,
        last_sync_count = p_variables_synced + p_secrets_synced
    WHERE id = p_sync_config_id;

    RETURN v_history;
END;
$$;

-- =====================================================
-- Grants
-- =====================================================

GRANT SELECT ON github_installations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON github_sync_configs TO authenticated;
GRANT SELECT ON github_sync_history TO authenticated;
GRANT EXECUTE ON FUNCTION get_github_installation TO authenticated;
GRANT EXECUTE ON FUNCTION get_environment_sync_configs TO authenticated;
GRANT EXECUTE ON FUNCTION get_variables_to_sync TO authenticated;
-- record_github_sync is SECURITY DEFINER, called by service role only

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE github_installations IS 'GitHub App installations linked to EnvManager organizations';
COMMENT ON TABLE github_sync_configs IS 'Configuration for syncing EnvManager environments to GitHub';
COMMENT ON TABLE github_sync_history IS 'Audit log of GitHub sync operations';
COMMENT ON COLUMN variables.sync_to_github IS 'When true, variable is included in GitHub sync (if sync_mode is selected)';
COMMENT ON FUNCTION get_variables_to_sync IS 'Returns decrypted variables for sync, respecting access control';
