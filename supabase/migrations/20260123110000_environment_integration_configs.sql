-- =====================================================
-- ENVIRONMENT INTEGRATION CONFIGS
-- Migration: 20260123110000_environment_integration_configs.sql
-- Description: Per-environment configuration for platform integrations
-- Enables staging to sync to service A while production syncs to service B
-- =====================================================

-- =====================================================
-- Environment Integration Configs Table
-- Links environments to platform integrations with optional prefix
-- =====================================================

CREATE TABLE environment_integration_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    project_integration_id UUID NOT NULL REFERENCES platform_integrations(id) ON DELETE CASCADE,
    target_config JSONB NOT NULL DEFAULT '{}',  -- Platform-specific target (app/project/service ID)
    prefix TEXT,                                 -- NULL = no prefix; underscore auto-added in app layer
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One config per environment per integration
    UNIQUE(environment_id, project_integration_id)
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE INDEX idx_env_integration_configs_environment
    ON environment_integration_configs(environment_id);

CREATE INDEX idx_env_integration_configs_integration
    ON environment_integration_configs(project_integration_id);

CREATE INDEX idx_env_integration_configs_enabled
    ON environment_integration_configs(environment_id)
    WHERE enabled = true;

-- =====================================================
-- Updated_at Trigger
-- =====================================================

CREATE TRIGGER update_env_integration_configs_updated_at
    BEFORE UPDATE ON environment_integration_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS Policies (dual-check: environment access + org membership)
-- =====================================================

ALTER TABLE environment_integration_configs ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can view configs for accessible environments in their org
CREATE POLICY "Users can view environment integration configs"
    ON environment_integration_configs FOR SELECT
    TO authenticated
    USING (
        -- User must have access to the environment
        environment_id IN (SELECT get_user_environment_ids())
        AND
        -- Integration must be in an org the user belongs to
        project_integration_id IN (
            SELECT id FROM platform_integrations
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- INSERT: Only owners/admins can create configs
CREATE POLICY "Admins can insert environment integration configs"
    ON environment_integration_configs FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User must have access to the environment
        environment_id IN (SELECT get_user_environment_ids())
        AND
        -- User must be admin/owner in the org that owns the integration
        project_integration_id IN (
            SELECT id FROM platform_integrations
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- UPDATE: Only owners/admins can update configs
CREATE POLICY "Admins can update environment integration configs"
    ON environment_integration_configs FOR UPDATE
    TO authenticated
    USING (
        environment_id IN (SELECT get_user_environment_ids())
        AND
        project_integration_id IN (
            SELECT id FROM platform_integrations
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    )
    WITH CHECK (
        environment_id IN (SELECT get_user_environment_ids())
        AND
        project_integration_id IN (
            SELECT id FROM platform_integrations
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- DELETE: Only owners/admins can delete configs
CREATE POLICY "Admins can delete environment integration configs"
    ON environment_integration_configs FOR DELETE
    TO authenticated
    USING (
        environment_id IN (SELECT get_user_environment_ids())
        AND
        project_integration_id IN (
            SELECT id FROM platform_integrations
            WHERE organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- =====================================================
-- Grants
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON environment_integration_configs TO authenticated;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE environment_integration_configs IS 'Per-environment configuration for platform integrations. Enables different environments to sync to different targets on the same platform (e.g., staging to app-A, production to app-B).';
COMMENT ON COLUMN environment_integration_configs.target_config IS 'Platform-specific target configuration (app ID, project ID, service ID, etc.)';
COMMENT ON COLUMN environment_integration_configs.prefix IS 'Optional prefix for variable keys when syncing. NULL means no prefix. Underscore separator added automatically in application layer.';
COMMENT ON COLUMN environment_integration_configs.enabled IS 'Whether this integration config is active for syncing';
