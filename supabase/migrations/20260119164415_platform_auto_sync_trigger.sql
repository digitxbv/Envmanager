-- =====================================================
-- PLATFORM AUTO-SYNC TRIGGER
-- Migration: 20260119164415_platform_auto_sync_trigger.sql
-- Description: Trigger to queue auto-sync when variables change for platform integrations
-- =====================================================

-- =====================================================
-- Platform Auto-Sync Queue Table
-- Debounces rapid variable changes (only one pending per config)
-- =====================================================

CREATE TABLE platform_auto_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_config_id UUID NOT NULL REFERENCES platform_sync_configs(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    change_type TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    variable_key TEXT,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,

    -- Only one pending sync per config (latest wins - debouncing)
    UNIQUE(sync_config_id)
);

CREATE INDEX idx_auto_sync_queue_pending ON platform_auto_sync_queue(queued_at)
    WHERE processed_at IS NULL;

-- =====================================================
-- Platform Synced Keys Table
-- Tracks which keys were synced for deletion handling
-- =====================================================

CREATE TABLE platform_synced_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_config_id UUID NOT NULL REFERENCES platform_sync_configs(id) ON DELETE CASCADE,
    variable_key TEXT NOT NULL,
    platform_key_id TEXT,  -- Platform's ID for the variable (for deletion API)
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(sync_config_id, variable_key)
);

CREATE INDEX idx_synced_keys_config ON platform_synced_keys(sync_config_id);

-- =====================================================
-- Function: Queue Platform Auto-Sync
-- Called when a variable changes in an environment with auto_sync enabled
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

    -- Find sync configs with auto_sync enabled that include this environment in their mapping
    -- The target JSONB contains environment_mapping array with envmanager_env fields
    FOR v_config IN
        SELECT psc.id, pi.platform
        FROM platform_sync_configs psc
        JOIN platform_integrations pi ON pi.id = psc.connection_id
        WHERE psc.auto_sync = true
          AND pi.disconnected_at IS NULL
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(psc.target->'environment_mapping') AS mapping
              WHERE (mapping->>'envmanager_env')::UUID = v_environment_id
          )
    LOOP
        -- Insert or update queue entry (debouncing - only latest matters)
        INSERT INTO platform_auto_sync_queue (
            sync_config_id,
            platform,
            change_type,
            variable_key,
            queued_at
        ) VALUES (
            v_config.id,
            v_config.platform,
            TG_OP,
            COALESCE(NEW.key, OLD.key),
            now()
        )
        ON CONFLICT (sync_config_id)
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
-- Trigger: Auto-sync on variable changes
-- =====================================================

CREATE TRIGGER trigger_platform_auto_sync
    AFTER INSERT OR UPDATE OR DELETE ON variables
    FOR EACH ROW
    EXECUTE FUNCTION queue_platform_auto_sync();

-- =====================================================
-- Function: Get Pending Platform Syncs
-- Called by edge function to process queue
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_platform_syncs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    queue_id UUID,
    sync_config_id UUID,
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
        q.sync_config_id,
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
-- Function: Mark Platform Sync Processed
-- Called after sync completes
-- =====================================================

CREATE OR REPLACE FUNCTION mark_platform_sync_processed(p_queue_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE platform_auto_sync_queue
    SET processed_at = now()
    WHERE id = p_queue_id;
$$;

-- =====================================================
-- Function: Update Synced Keys Tracking
-- Upserts keys that were synced, returns keys to delete
-- =====================================================

CREATE OR REPLACE FUNCTION update_synced_keys(
    p_sync_config_id UUID,
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
    WHERE sync_config_id = p_sync_config_id
      AND variable_key != ALL(p_synced_keys);

    -- Upsert the new synced keys
    INSERT INTO platform_synced_keys (sync_config_id, variable_key, last_synced_at)
    SELECT p_sync_config_id, unnest(p_synced_keys), now()
    ON CONFLICT (sync_config_id, variable_key)
    DO UPDATE SET last_synced_at = now();

    -- Remove deleted keys from tracking
    IF v_keys_to_delete IS NOT NULL AND array_length(v_keys_to_delete, 1) > 0 THEN
        DELETE FROM platform_synced_keys
        WHERE sync_config_id = p_sync_config_id
          AND variable_key = ANY(v_keys_to_delete);
    END IF;

    RETURN COALESCE(v_keys_to_delete, ARRAY[]::TEXT[]);
END;
$$;

-- =====================================================
-- Cleanup function for old queue entries
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_platform_sync_queue()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH deleted AS (
        DELETE FROM platform_auto_sync_queue
        WHERE processed_at IS NOT NULL
          AND processed_at < now() - INTERVAL '7 days'
        RETURNING 1
    )
    SELECT count(*)::INTEGER FROM deleted;
$$;

-- =====================================================
-- RLS Policies (service role only)
-- =====================================================

ALTER TABLE platform_auto_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_synced_keys ENABLE ROW LEVEL SECURITY;

-- No user-facing policies - these are managed by service role only

-- =====================================================
-- Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION get_pending_platform_syncs TO service_role;
GRANT EXECUTE ON FUNCTION mark_platform_sync_processed TO service_role;
GRANT EXECUTE ON FUNCTION update_synced_keys TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_platform_sync_queue TO service_role;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE platform_auto_sync_queue IS 'Queue for pending platform sync operations triggered by variable changes';
COMMENT ON TABLE platform_synced_keys IS 'Tracks which variable keys have been synced to platforms for deletion handling';
COMMENT ON FUNCTION queue_platform_auto_sync IS 'Trigger function that queues syncs when variables change';
COMMENT ON FUNCTION get_pending_platform_syncs IS 'Returns pending syncs for batch processing';
COMMENT ON FUNCTION update_synced_keys IS 'Updates synced keys tracking and returns keys that should be deleted';
