-- =====================================================
-- SYNC HISTORY ENV CONFIG FK
-- Migration: 20260126144935_sync_history_env_config_fk.sql
-- Description: Update platform_sync_history to reference environment_integration_configs
--              instead of platform_sync_configs for v1.1 per-environment sync tracking
--              This was missed in migration 20260126131155_synced_keys_env_config_fk.sql
-- =====================================================

-- =====================================================
-- Step 1: Drop existing constraints and indexes
-- =====================================================

ALTER TABLE platform_sync_history
    DROP CONSTRAINT IF EXISTS platform_sync_history_sync_config_id_fkey;

DROP INDEX IF EXISTS idx_platform_sync_history_config;

-- =====================================================
-- Step 2: Rename column and add new FK
-- =====================================================

ALTER TABLE platform_sync_history
    RENAME COLUMN sync_config_id TO env_config_id;

ALTER TABLE platform_sync_history
    ADD CONSTRAINT platform_sync_history_env_config_id_fkey
    FOREIGN KEY (env_config_id)
    REFERENCES environment_integration_configs(id)
    ON DELETE CASCADE;

-- =====================================================
-- Step 3: Recreate index
-- =====================================================

CREATE INDEX idx_platform_sync_history_env_config ON platform_sync_history(env_config_id);

-- =====================================================
-- Step 4: Update the record_platform_sync function
-- Now expects environment_integration_configs.id
-- =====================================================

CREATE OR REPLACE FUNCTION record_platform_sync(
    p_sync_config_id UUID,  -- Now expects environment_integration_configs.id (param name kept for edge function compat)
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
    -- Insert history record (now using env_config_id column)
    INSERT INTO platform_sync_history (
        env_config_id,
        triggered_by,
        trigger_type,
        variables_synced,
        secrets_synced,
        status,
        error_message,
        details
    ) VALUES (
        p_sync_config_id,  -- This is actually env_config_id now
        p_triggered_by,
        p_trigger_type,
        p_variables_synced,
        p_secrets_synced,
        p_status,
        p_error_message,
        p_details
    )
    RETURNING * INTO v_history;

    -- Update environment_integration_configs with latest status
    UPDATE environment_integration_configs
    SET
        last_synced_at = now(),
        updated_at = now()
    WHERE id = p_sync_config_id;

    RETURN v_history;
END;
$$;

-- =====================================================
-- Step 5: Update RLS policy for platform_sync_history
-- Now references environment_integration_configs
-- =====================================================

DROP POLICY IF EXISTS "Users can view sync history via config" ON platform_sync_history;

CREATE POLICY "Users can view sync history via env config"
    ON platform_sync_history FOR SELECT
    TO authenticated
    USING (
        env_config_id IN (
            SELECT id FROM environment_integration_configs
            WHERE environment_id IN (SELECT get_user_environment_ids())
            AND project_integration_id IN (
                SELECT id FROM platform_integrations
                WHERE organization_id IN (
                    SELECT organization_id FROM organization_members
                    WHERE user_id = auth.uid()
                )
            )
        )
    );

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE platform_sync_history IS 'Audit log of platform sync operations per environment config';
COMMENT ON COLUMN platform_sync_history.env_config_id IS 'Reference to environment_integration_configs.id';
