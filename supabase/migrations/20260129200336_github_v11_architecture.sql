-- =====================================================
-- GITHUB V1.1 ARCHITECTURE
-- Migration: 20260129200336_github_v11_architecture.sql
-- Description: Bridge GitHub App OAuth to v1.1 per-environment sync pattern
-- Adds project sync configs and environment configs that FK to github_installations
-- =====================================================

-- =====================================================
-- GitHub Project Sync Configs Table
-- Project-level enable/disable (mirrors platform_sync_configs)
-- =====================================================

CREATE TABLE github_project_sync_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id UUID NOT NULL REFERENCES github_installations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Sync behavior (shared across all environments)
    auto_sync BOOLEAN NOT NULL DEFAULT false,
    sync_secrets BOOLEAN NOT NULL DEFAULT true,
    sync_variables BOOLEAN NOT NULL DEFAULT true,
    sync_mode TEXT NOT NULL DEFAULT 'selected' CHECK (sync_mode IN ('all', 'selected')),

    -- Status tracking
    last_synced_at TIMESTAMPTZ,
    last_status TEXT CHECK (last_status IN ('success', 'partial', 'failed')),
    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One config per project per installation
    UNIQUE(installation_id, project_id)
);

-- =====================================================
-- GitHub Environment Configs Table
-- Per-env config with target_config JSONB (mirrors environment_integration_configs)
-- =====================================================

CREATE TABLE github_environment_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_sync_config_id UUID NOT NULL REFERENCES github_project_sync_configs(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,

    -- Target configuration (sync_level, repo_owner, repo_name, github_environment)
    target_config JSONB NOT NULL DEFAULT '{}',

    -- Optional prefix for variable keys
    prefix TEXT,

    -- Enable/disable per environment
    enabled BOOLEAN NOT NULL DEFAULT true,

    -- Status tracking
    last_synced_at TIMESTAMPTZ,
    last_status TEXT CHECK (last_status IN ('success', 'partial', 'failed')),
    last_error TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- One config per environment per project sync config
    UNIQUE(project_sync_config_id, environment_id)
);

-- =====================================================
-- GitHub Synced Keys Table
-- Track synced keys for deletion detection
-- =====================================================

CREATE TABLE github_synced_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    env_config_id UUID NOT NULL REFERENCES github_environment_configs(id) ON DELETE CASCADE,
    variable_key TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(env_config_id, variable_key)
);

-- =====================================================
-- Modify existing tables
-- =====================================================

-- Add env_config_id to github_sync_history, make sync_config_id nullable for legacy support
ALTER TABLE github_sync_history
    ADD COLUMN env_config_id UUID REFERENCES github_environment_configs(id) ON DELETE CASCADE,
    ALTER COLUMN sync_config_id DROP NOT NULL;

-- Add constraint: either sync_config_id OR env_config_id must be set
ALTER TABLE github_sync_history
    ADD CONSTRAINT github_sync_history_config_check
    CHECK (sync_config_id IS NOT NULL OR env_config_id IS NOT NULL);

-- =====================================================
-- Indexes
-- =====================================================

-- Project sync configs
CREATE INDEX idx_github_project_sync_configs_installation
    ON github_project_sync_configs(installation_id);
CREATE INDEX idx_github_project_sync_configs_project
    ON github_project_sync_configs(project_id);

-- Environment configs
CREATE INDEX idx_github_environment_configs_project_sync
    ON github_environment_configs(project_sync_config_id);
CREATE INDEX idx_github_environment_configs_environment
    ON github_environment_configs(environment_id);
CREATE INDEX idx_github_environment_configs_enabled
    ON github_environment_configs(project_sync_config_id)
    WHERE enabled = true;

-- Synced keys
CREATE INDEX idx_github_synced_keys_env_config
    ON github_synced_keys(env_config_id);

-- Sync history env_config_id
CREATE INDEX idx_github_sync_history_env_config
    ON github_sync_history(env_config_id)
    WHERE env_config_id IS NOT NULL;

-- =====================================================
-- Triggers
-- =====================================================

CREATE TRIGGER update_github_project_sync_configs_updated_at
    BEFORE UPDATE ON github_project_sync_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_github_environment_configs_updated_at
    BEFORE UPDATE ON github_environment_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE github_project_sync_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_environment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE github_synced_keys ENABLE ROW LEVEL SECURITY;

-- GitHub Project Sync Configs: Users can view configs for their projects
CREATE POLICY "Users can view github project sync configs"
    ON github_project_sync_configs FOR SELECT
    TO authenticated
    USING (
        -- Project must be in an org the user belongs to
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid()
            )
        )
    );

-- GitHub Project Sync Configs: Admins can insert
CREATE POLICY "Admins can insert github project sync configs"
    ON github_project_sync_configs FOR INSERT
    TO authenticated
    WITH CHECK (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- GitHub Project Sync Configs: Admins can update
CREATE POLICY "Admins can update github project sync configs"
    ON github_project_sync_configs FOR UPDATE
    TO authenticated
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    )
    WITH CHECK (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- GitHub Project Sync Configs: Admins can delete
CREATE POLICY "Admins can delete github project sync configs"
    ON github_project_sync_configs FOR DELETE
    TO authenticated
    USING (
        project_id IN (
            SELECT p.id FROM projects p
            WHERE p.organization_id IN (
                SELECT organization_id FROM organization_members
                WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
            )
        )
    );

-- GitHub Environment Configs: Users with env access can view
CREATE POLICY "Users can view github environment configs"
    ON github_environment_configs FOR SELECT
    TO authenticated
    USING (
        environment_id IN (SELECT get_user_environment_ids())
        AND
        project_sync_config_id IN (
            SELECT id FROM github_project_sync_configs
            WHERE project_id IN (
                SELECT p.id FROM projects p
                WHERE p.organization_id IN (
                    SELECT organization_id FROM organization_members
                    WHERE user_id = auth.uid()
                )
            )
        )
    );

-- GitHub Environment Configs: Admins can insert
CREATE POLICY "Admins can insert github environment configs"
    ON github_environment_configs FOR INSERT
    TO authenticated
    WITH CHECK (
        environment_id IN (SELECT get_user_environment_ids())
        AND
        project_sync_config_id IN (
            SELECT id FROM github_project_sync_configs
            WHERE project_id IN (
                SELECT p.id FROM projects p
                WHERE p.organization_id IN (
                    SELECT organization_id FROM organization_members
                    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
                )
            )
        )
    );

-- GitHub Environment Configs: Admins can update
CREATE POLICY "Admins can update github environment configs"
    ON github_environment_configs FOR UPDATE
    TO authenticated
    USING (
        environment_id IN (SELECT get_user_environment_ids())
        AND
        project_sync_config_id IN (
            SELECT id FROM github_project_sync_configs
            WHERE project_id IN (
                SELECT p.id FROM projects p
                WHERE p.organization_id IN (
                    SELECT organization_id FROM organization_members
                    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
                )
            )
        )
    )
    WITH CHECK (
        environment_id IN (SELECT get_user_environment_ids())
        AND
        project_sync_config_id IN (
            SELECT id FROM github_project_sync_configs
            WHERE project_id IN (
                SELECT p.id FROM projects p
                WHERE p.organization_id IN (
                    SELECT organization_id FROM organization_members
                    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
                )
            )
        )
    );

-- GitHub Environment Configs: Admins can delete
CREATE POLICY "Admins can delete github environment configs"
    ON github_environment_configs FOR DELETE
    TO authenticated
    USING (
        environment_id IN (SELECT get_user_environment_ids())
        AND
        project_sync_config_id IN (
            SELECT id FROM github_project_sync_configs
            WHERE project_id IN (
                SELECT p.id FROM projects p
                WHERE p.organization_id IN (
                    SELECT organization_id FROM organization_members
                    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
                )
            )
        )
    );

-- GitHub Synced Keys: Read-only for authenticated users
CREATE POLICY "Users can view github synced keys"
    ON github_synced_keys FOR SELECT
    TO authenticated
    USING (
        env_config_id IN (
            SELECT gec.id FROM github_environment_configs gec
            WHERE gec.environment_id IN (SELECT get_user_environment_ids())
        )
    );

-- =====================================================
-- RPC Functions
-- =====================================================

-- Enable GitHub for a project
CREATE OR REPLACE FUNCTION enable_github_for_project(
    p_installation_id UUID,
    p_project_id UUID
)
RETURNS github_project_sync_configs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config github_project_sync_configs;
BEGIN
    -- Verify user has admin access to the project's org
    IF NOT EXISTS (
        SELECT 1 FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE p.id = p_project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Insert or return existing config
    INSERT INTO github_project_sync_configs (
        installation_id,
        project_id
    ) VALUES (
        p_installation_id,
        p_project_id
    )
    ON CONFLICT (installation_id, project_id) DO NOTHING
    RETURNING * INTO v_config;

    -- If nothing was inserted, fetch existing
    IF v_config IS NULL THEN
        SELECT * INTO v_config
        FROM github_project_sync_configs
        WHERE installation_id = p_installation_id
        AND project_id = p_project_id;
    END IF;

    RETURN v_config;
END;
$$;

-- Disable GitHub for a project
CREATE OR REPLACE FUNCTION disable_github_for_project(
    p_project_id UUID,
    p_installation_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify user has admin access to the project's org
    IF NOT EXISTS (
        SELECT 1 FROM projects p
        JOIN organization_members om ON p.organization_id = om.organization_id
        WHERE p.id = p_project_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Delete config (CASCADE will clean up environment configs and synced keys)
    DELETE FROM github_project_sync_configs
    WHERE project_id = p_project_id
    AND installation_id = p_installation_id;
END;
$$;

-- Update synced keys for a GitHub environment config
CREATE OR REPLACE FUNCTION update_github_synced_keys(
    p_env_config_id UUID,
    p_synced_keys TEXT[]
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_keys_to_delete TEXT[];
BEGIN
    -- Find keys that exist in tracking but not in the new sync (need deletion)
    SELECT array_agg(variable_key)
    INTO v_keys_to_delete
    FROM github_synced_keys
    WHERE env_config_id = p_env_config_id
      AND variable_key != ALL(p_synced_keys);

    -- Upsert the new synced keys
    INSERT INTO github_synced_keys (env_config_id, variable_key, last_synced_at)
    SELECT p_env_config_id, unnest(p_synced_keys), now()
    ON CONFLICT (env_config_id, variable_key)
    DO UPDATE SET last_synced_at = now();

    -- Remove deleted keys from tracking
    IF v_keys_to_delete IS NOT NULL AND array_length(v_keys_to_delete, 1) > 0 THEN
        DELETE FROM github_synced_keys
        WHERE env_config_id = p_env_config_id
          AND variable_key = ANY(v_keys_to_delete);
    END IF;

    RETURN COALESCE(v_keys_to_delete, ARRAY[]::TEXT[]);
END;
$$;

-- Record a GitHub sync operation for v1.1 (env_config_id based)
CREATE OR REPLACE FUNCTION record_github_sync_v11(
    p_env_config_id UUID,
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
    v_env_config github_environment_configs;
BEGIN
    v_started_at := now();

    -- Insert history record
    INSERT INTO github_sync_history (
        env_config_id,
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
        p_env_config_id,
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

    -- Update environment config with latest status
    UPDATE github_environment_configs
    SET
        last_synced_at = now(),
        last_status = p_status,
        last_error = p_error_message
    WHERE id = p_env_config_id;

    -- Also update project sync config's last_synced_at and status
    UPDATE github_project_sync_configs
    SET 
        last_synced_at = now(),
        last_status = p_status,
        last_error = p_error_message
    WHERE id = (
        SELECT project_sync_config_id
        FROM github_environment_configs
        WHERE id = p_env_config_id
    );

    RETURN v_history;
END;
$$;

-- =====================================================
-- Grants
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON github_project_sync_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON github_environment_configs TO authenticated;
GRANT SELECT ON github_synced_keys TO authenticated;

GRANT EXECUTE ON FUNCTION enable_github_for_project TO authenticated;
GRANT EXECUTE ON FUNCTION disable_github_for_project TO authenticated;
-- update_github_synced_keys and record_github_sync_v11 are SECURITY DEFINER, called by service role

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE github_project_sync_configs IS 'Project-level GitHub sync configuration, links projects to GitHub installations';
COMMENT ON TABLE github_environment_configs IS 'Per-environment GitHub sync targets and settings';
COMMENT ON TABLE github_synced_keys IS 'Tracks which variable keys have been synced to GitHub per environment config';
COMMENT ON COLUMN github_environment_configs.target_config IS 'GitHub target: sync_level, repo_owner, repo_name, github_environment';
COMMENT ON COLUMN github_environment_configs.prefix IS 'Optional prefix for variable keys when syncing';

-- =====================================================
-- Auto-Sync Trigger Migration
-- Migrate github_pending_syncs to use env_config_id
-- =====================================================

ALTER TABLE github_pending_syncs 
ADD COLUMN env_config_id UUID REFERENCES github_environment_configs(id) ON DELETE CASCADE;

ALTER TABLE github_pending_syncs 
ALTER COLUMN sync_config_id DROP NOT NULL;

CREATE INDEX idx_github_pending_syncs_env_config ON github_pending_syncs(env_config_id) 
WHERE env_config_id IS NOT NULL;

-- =====================================================
-- New Auto-Sync Trigger Function for v1.1 Architecture
-- Queues syncs based on github_environment_configs
-- =====================================================

CREATE OR REPLACE FUNCTION queue_github_env_auto_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config RECORD;
    v_environment_id UUID;
    v_sync_mode TEXT;
BEGIN
    v_environment_id := COALESCE(NEW.environment_id, OLD.environment_id);

    FOR v_config IN
        SELECT 
            gec.id as env_config_id,
            gpsc.sync_mode,
            gpsc.auto_sync
        FROM github_environment_configs gec
        JOIN github_project_sync_configs gpsc ON gpsc.id = gec.project_sync_config_id
        WHERE gec.environment_id = v_environment_id
          AND gec.enabled = true
          AND gpsc.auto_sync = true
    LOOP
        v_sync_mode := v_config.sync_mode;

        IF v_sync_mode = 'selected' THEN
            IF TG_OP = 'DELETE' THEN
                IF NOT OLD.sync_to_github THEN
                    CONTINUE;
                END IF;
            ELSE
                IF NOT NEW.sync_to_github THEN
                    CONTINUE;
                END IF;
            END IF;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM github_pending_syncs
            WHERE env_config_id = v_config.env_config_id
            AND status = 'pending'
            AND created_at > now() - INTERVAL '5 seconds'
        ) THEN
            INSERT INTO github_pending_syncs (
                env_config_id,
                environment_id,
                trigger_reason,
                variable_id
            ) VALUES (
                v_config.env_config_id,
                v_environment_id,
                CASE TG_OP 
                    WHEN 'INSERT' THEN 'variable_created'
                    WHEN 'UPDATE' THEN 'variable_updated'
                    WHEN 'DELETE' THEN 'variable_deleted'
                END,
                COALESCE(NEW.id, OLD.id)
            );
        END IF;
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_github_auto_sync ON variables;

CREATE TRIGGER trigger_github_env_auto_sync
    AFTER INSERT OR UPDATE OR DELETE ON variables
    FOR EACH ROW
    EXECUTE FUNCTION queue_github_env_auto_sync();

-- =====================================================
-- Updated get_pending_github_syncs for v1.1
-- Returns env_config_id instead of sync_config_id
-- =====================================================

DROP FUNCTION IF EXISTS get_pending_github_syncs(INTEGER);

CREATE FUNCTION get_pending_github_syncs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    pending_sync_id UUID,
    env_config_id UUID,
    environment_id UUID,
    installation_id UUID,
    trigger_reason TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        ps.id as pending_sync_id,
        ps.env_config_id,
        ps.environment_id,
        gpsc.installation_id,
        ps.trigger_reason
    FROM github_pending_syncs ps
    JOIN github_environment_configs gec ON ps.env_config_id = gec.id
    JOIN github_project_sync_configs gpsc ON gec.project_sync_config_id = gpsc.id
    WHERE ps.status = 'pending'
    AND ps.env_config_id IS NOT NULL
    AND ps.attempts < 3
    ORDER BY ps.created_at ASC
    LIMIT p_limit;
$$;

COMMENT ON FUNCTION queue_github_env_auto_sync IS 'v1.1 trigger function that queues syncs based on github_environment_configs';
