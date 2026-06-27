-- =====================================================
-- GITHUB AUTO-SYNC TRIGGER
-- Migration: 20260117140000_github_auto_sync_trigger.sql
-- Description: Trigger to queue auto-sync when variables change
-- =====================================================

-- =====================================================
-- Pending Sync Queue Table
-- Stores pending sync operations for batch processing
-- =====================================================

CREATE TABLE github_pending_syncs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_config_id UUID NOT NULL REFERENCES github_sync_configs(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    trigger_reason TEXT NOT NULL, -- 'variable_created', 'variable_updated', 'variable_deleted'
    variable_id UUID, -- optional reference to the changed variable
    
    -- Processing state
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    processed_at TIMESTAMPTZ
);

-- Index for processing pending syncs
CREATE INDEX idx_github_pending_syncs_status ON github_pending_syncs(status, created_at) 
    WHERE status = 'pending';

-- =====================================================
-- Function: Queue GitHub Sync
-- Called when a variable changes in an environment with auto-sync enabled
-- =====================================================

CREATE OR REPLACE FUNCTION queue_github_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sync_config RECORD;
    v_trigger_reason TEXT;
    v_variable_id UUID;
    v_environment_id UUID;
BEGIN
    -- Determine the trigger reason and affected variable
    IF TG_OP = 'INSERT' THEN
        v_trigger_reason := 'variable_created';
        v_variable_id := NEW.id;
        v_environment_id := NEW.environment_id;
    ELSIF TG_OP = 'UPDATE' THEN
        v_trigger_reason := 'variable_updated';
        v_variable_id := NEW.id;
        v_environment_id := NEW.environment_id;
    ELSIF TG_OP = 'DELETE' THEN
        v_trigger_reason := 'variable_deleted';
        v_variable_id := OLD.id;
        v_environment_id := OLD.environment_id;
    END IF;

    -- Find all auto-sync configs for this environment
    FOR v_sync_config IN
        SELECT id, sync_mode
        FROM github_sync_configs
        WHERE environment_id = v_environment_id
        AND auto_sync = true
    LOOP
        -- For 'selected' mode, only queue if the variable has sync_to_github = true
        IF v_sync_config.sync_mode = 'selected' THEN
            IF TG_OP = 'DELETE' THEN
                -- For deletes, check the OLD record
                IF NOT OLD.sync_to_github THEN
                    CONTINUE;
                END IF;
            ELSE
                -- For inserts/updates, check the NEW record
                IF NOT NEW.sync_to_github THEN
                    CONTINUE;
                END IF;
            END IF;
        END IF;

        -- Check if there's already a pending sync for this config (deduplication)
        -- Only queue a new sync if no pending sync exists within last 5 seconds
        IF NOT EXISTS (
            SELECT 1 FROM github_pending_syncs
            WHERE sync_config_id = v_sync_config.id
            AND status = 'pending'
            AND created_at > now() - INTERVAL '5 seconds'
        ) THEN
            INSERT INTO github_pending_syncs (
                sync_config_id,
                environment_id,
                trigger_reason,
                variable_id
            ) VALUES (
                v_sync_config.id,
                v_environment_id,
                v_trigger_reason,
                v_variable_id
            );
        END IF;
    END LOOP;

    -- Return appropriate value based on operation
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- =====================================================
-- Trigger: Auto-sync on variable changes
-- =====================================================

CREATE TRIGGER trigger_github_auto_sync
    AFTER INSERT OR UPDATE OR DELETE ON variables
    FOR EACH ROW
    EXECUTE FUNCTION queue_github_sync();

-- =====================================================
-- Function: Process Pending Syncs
-- Called by a scheduled job or edge function
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_github_syncs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    pending_sync_id UUID,
    sync_config_id UUID,
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
        ps.sync_config_id,
        ps.environment_id,
        sc.installation_id,
        ps.trigger_reason
    FROM github_pending_syncs ps
    JOIN github_sync_configs sc ON ps.sync_config_id = sc.id
    WHERE ps.status = 'pending'
    AND ps.attempts < 3
    ORDER BY ps.created_at ASC
    LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION mark_sync_processing(p_pending_sync_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE github_pending_syncs
    SET status = 'processing', attempts = attempts + 1
    WHERE id = p_pending_sync_id;
$$;

CREATE OR REPLACE FUNCTION mark_sync_completed(p_pending_sync_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE github_pending_syncs
    SET status = 'completed', processed_at = now()
    WHERE id = p_pending_sync_id;
$$;

CREATE OR REPLACE FUNCTION mark_sync_failed(p_pending_sync_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
AS $$
    UPDATE github_pending_syncs
    SET status = CASE WHEN attempts >= 3 THEN 'failed' ELSE 'pending' END,
        last_error = p_error
    WHERE id = p_pending_sync_id;
$$;

-- =====================================================
-- Cleanup old pending syncs (run periodically)
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_pending_syncs()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
    WITH deleted AS (
        DELETE FROM github_pending_syncs
        WHERE (status = 'completed' AND processed_at < now() - INTERVAL '7 days')
           OR (status = 'failed' AND created_at < now() - INTERVAL '30 days')
        RETURNING 1
    )
    SELECT count(*)::INTEGER FROM deleted;
$$;

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE github_pending_syncs ENABLE ROW LEVEL SECURITY;

-- Only service role can access pending syncs (for processing)
-- No policies for authenticated users - this is backend-only

-- =====================================================
-- Grants
-- =====================================================

GRANT EXECUTE ON FUNCTION get_pending_github_syncs TO service_role;
GRANT EXECUTE ON FUNCTION mark_sync_processing TO service_role;
GRANT EXECUTE ON FUNCTION mark_sync_completed TO service_role;
GRANT EXECUTE ON FUNCTION mark_sync_failed TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_pending_syncs TO service_role;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE github_pending_syncs IS 'Queue for pending GitHub sync operations triggered by variable changes';
COMMENT ON FUNCTION queue_github_sync IS 'Trigger function that queues syncs when variables change';
COMMENT ON FUNCTION get_pending_github_syncs IS 'Returns pending syncs for batch processing';
