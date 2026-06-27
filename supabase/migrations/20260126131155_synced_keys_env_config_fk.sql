-- =====================================================
-- SYNCED KEYS ENV CONFIG FK
-- Migration: 20260126131155_synced_keys_env_config_fk.sql
-- Description: Update platform_synced_keys to reference environment_integration_configs
--              instead of platform_sync_configs for v1.1 per-environment sync tracking
-- =====================================================

-- =====================================================
-- Step 1: Drop existing constraints and indexes
-- =====================================================

ALTER TABLE platform_synced_keys
    DROP CONSTRAINT IF EXISTS platform_synced_keys_sync_config_id_fkey;

ALTER TABLE platform_synced_keys
    DROP CONSTRAINT IF EXISTS platform_synced_keys_sync_config_id_variable_key_key;

DROP INDEX IF EXISTS idx_synced_keys_config;

-- =====================================================
-- Step 2: Rename column and add new FK
-- =====================================================

ALTER TABLE platform_synced_keys
    RENAME COLUMN sync_config_id TO env_config_id;

ALTER TABLE platform_synced_keys
    ADD CONSTRAINT platform_synced_keys_env_config_id_fkey
    FOREIGN KEY (env_config_id)
    REFERENCES environment_integration_configs(id)
    ON DELETE CASCADE;

-- =====================================================
-- Step 3: Recreate unique constraint and index
-- =====================================================

ALTER TABLE platform_synced_keys
    ADD CONSTRAINT platform_synced_keys_env_config_id_variable_key_key
    UNIQUE (env_config_id, variable_key);

CREATE INDEX idx_synced_keys_env_config ON platform_synced_keys(env_config_id);

-- =====================================================
-- Step 4: Update the update_synced_keys function
-- =====================================================

CREATE OR REPLACE FUNCTION update_synced_keys(
    p_sync_config_id UUID,  -- Now expects environment_integration_configs.id
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
    FROM platform_synced_keys
    WHERE env_config_id = p_sync_config_id
      AND variable_key != ALL(p_synced_keys);

    -- Upsert the new synced keys
    INSERT INTO platform_synced_keys (env_config_id, variable_key, last_synced_at)
    SELECT p_sync_config_id, unnest(p_synced_keys), now()
    ON CONFLICT (env_config_id, variable_key)
    DO UPDATE SET last_synced_at = now();

    -- Remove deleted keys from tracking
    IF v_keys_to_delete IS NOT NULL AND array_length(v_keys_to_delete, 1) > 0 THEN
        DELETE FROM platform_synced_keys
        WHERE env_config_id = p_sync_config_id
          AND variable_key = ANY(v_keys_to_delete);
    END IF;

    RETURN COALESCE(v_keys_to_delete, ARRAY[]::TEXT[]);
END;
$$;

-- =====================================================
-- Step 5: Also update auto-sync queue to use env_config_id
-- =====================================================

ALTER TABLE platform_auto_sync_queue
    DROP CONSTRAINT IF EXISTS platform_auto_sync_queue_sync_config_id_fkey;

ALTER TABLE platform_auto_sync_queue
    DROP CONSTRAINT IF EXISTS platform_auto_sync_queue_sync_config_id_key;

ALTER TABLE platform_auto_sync_queue
    RENAME COLUMN sync_config_id TO env_config_id;

ALTER TABLE platform_auto_sync_queue
    ADD CONSTRAINT platform_auto_sync_queue_env_config_id_fkey
    FOREIGN KEY (env_config_id)
    REFERENCES environment_integration_configs(id)
    ON DELETE CASCADE;

ALTER TABLE platform_auto_sync_queue
    ADD CONSTRAINT platform_auto_sync_queue_env_config_id_key
    UNIQUE (env_config_id);

-- =====================================================
-- Step 6: Update queue functions
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_platform_syncs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    queue_id UUID,
    sync_config_id UUID,  -- Keep param name for backwards compat with edge functions
    platform TEXT,
    change_type TEXT,
    variable_key TEXT,
    queued_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        q.id as queue_id,
        q.env_config_id as sync_config_id,  -- Return as sync_config_id for edge function compat
        q.platform,
        q.change_type,
        q.variable_key,
        q.queued_at
    FROM platform_auto_sync_queue q
    WHERE q.processed_at IS NULL
    ORDER BY q.queued_at ASC
    LIMIT p_limit;
$$;

-- =====================================================
-- Step 7: Update the trigger function for auto-sync queue
-- Now queues based on environment_integration_configs
-- =====================================================

CREATE OR REPLACE FUNCTION queue_platform_auto_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_config RECORD;
    v_environment_id UUID;
BEGIN
    -- Determine environment_id from the variable change
    v_environment_id := COALESCE(NEW.environment_id, OLD.environment_id);

    -- Find environment integration configs with auto_sync enabled for this environment
    FOR v_config IN
        SELECT eic.id as env_config_id, pi.platform
        FROM environment_integration_configs eic
        JOIN platform_integrations pi ON pi.id = eic.project_integration_id
        WHERE eic.environment_id = v_environment_id
          AND eic.enabled = true
          AND pi.disconnected_at IS NULL
          -- Check if auto_sync is enabled in target_config
          AND (eic.target_config->>'auto_sync')::boolean = true
    LOOP
        -- Insert or update queue entry (debouncing - only latest matters)
        INSERT INTO platform_auto_sync_queue (
            env_config_id,
            platform,
            change_type,
            variable_key,
            queued_at
        ) VALUES (
            v_config.env_config_id,
            v_config.platform,
            TG_OP,
            COALESCE(NEW.key, OLD.key),
            now()
        )
        ON CONFLICT (env_config_id)
        DO UPDATE SET
            change_type = EXCLUDED.change_type,
            variable_key = EXCLUDED.variable_key,
            queued_at = now(),
            processed_at = NULL;  -- Reset processed state
    END LOOP;

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE platform_synced_keys IS 'Tracks which variable keys have been synced to platforms per environment config';
COMMENT ON TABLE platform_auto_sync_queue IS 'Queue for pending platform sync operations per environment config';
