-- Migration: Version History RPC Functions
-- PRD: 04 (Version History) — Task 1.2
-- Adds metadata column to audit log, updates trigger, and creates 5 RPC functions

-- ============================================================
-- Part A: Add missing metadata JSONB column to variable_audit_log
-- ============================================================
ALTER TABLE variable_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ============================================================
-- Part A: Update trigger to populate metadata with vault_secret_id
-- ============================================================
CREATE OR REPLACE FUNCTION log_variable_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    action_type TEXT;
    old_val TEXT;
    new_val TEXT;
    meta JSONB;
BEGIN
    meta := NULL;

    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        old_val := NULL;
        IF NEW.is_secret THEN
            new_val := 'vault:' || NEW.vault_secret_id::TEXT;
            meta := jsonb_build_object('vault_secret_id', NEW.vault_secret_id);
        ELSE
            new_val := NEW.value;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'updated';
        IF OLD.is_secret OR NEW.is_secret THEN
            old_val := 'vault:' || COALESCE(OLD.vault_secret_id::TEXT, 'none');
            new_val := 'vault:' || COALESCE(NEW.vault_secret_id::TEXT, 'none');
            meta := jsonb_build_object(
                'old_vault_secret_id', OLD.vault_secret_id,
                'vault_secret_id', NEW.vault_secret_id
            );
        ELSE
            old_val := OLD.value;
            new_val := NEW.value;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'deleted';
        IF OLD.is_secret THEN
            old_val := 'vault:' || OLD.vault_secret_id::TEXT;
            meta := jsonb_build_object('vault_secret_id', OLD.vault_secret_id);
        ELSE
            old_val := OLD.value;
        END IF;
        new_val := NULL;
    END IF;

    INSERT INTO variable_audit_log (
        variable_id,
        organization_id,
        environment_id,
        user_id,
        action,
        old_value,
        new_value,
        variable_key,
        version_number,
        metadata
    ) VALUES (
        CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE COALESCE(NEW.id, OLD.id) END,
        COALESCE(NEW.organization_id, OLD.organization_id),
        COALESCE(NEW.environment_id, OLD.environment_id),
        COALESCE(
            CASE WHEN TG_OP != 'DELETE' THEN NEW.updated_by ELSE NULL END,
            auth.uid()
        ),
        action_type,
        old_val,
        new_val,
        COALESCE(NEW.key, OLD.key),
        COALESCE(NEW.version, OLD.version),
        meta
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- ============================================================
-- Part B.1: get_variable_history — paginated history with user emails
-- ============================================================
CREATE OR REPLACE FUNCTION get_variable_history(
    p_variable_id UUID,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    variable_key TEXT,
    version_number INT,
    action TEXT,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    user_id UUID,
    user_email TEXT,
    created_at TIMESTAMPTZ,
    batch_id UUID,
    metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify user has access to the variable's organization
    IF NOT EXISTS (
        SELECT 1 FROM variables v
        JOIN organization_members om ON om.organization_id = v.organization_id
        WHERE v.id = p_variable_id
        AND om.user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    RETURN QUERY
    SELECT
        val.id,
        val.variable_key,
        val.version_number,
        val.action,
        val.old_value,
        val.new_value,
        val.change_reason,
        val.user_id,
        COALESCE(au.email, 'unknown')::TEXT as user_email,
        val.created_at,
        val.batch_id,
        val.metadata
    FROM variable_audit_log val
    LEFT JOIN auth.users au ON au.id = val.user_id
    WHERE val.variable_id = p_variable_id
    ORDER BY val.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_variable_history(UUID, INT, INT) TO authenticated;

-- ============================================================
-- Part B.2: rollback_variable — rollback with protected env support
-- ============================================================
CREATE OR REPLACE FUNCTION rollback_variable(
    p_variable_id UUID,
    p_target_version INT,
    p_reason TEXT DEFAULT 'Rolled back to previous version'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_variable RECORD;
    v_audit_entry RECORD;
    v_is_protected BOOLEAN;
    v_org_id UUID;
    v_env_id UUID;
    v_rollback_value TEXT;
    v_is_secret BOOLEAN;
    v_pending_id UUID;
BEGIN
    -- Get current variable
    SELECT * INTO v_variable FROM variables WHERE id = p_variable_id;
    IF v_variable IS NULL THEN
        RAISE EXCEPTION 'Variable not found';
    END IF;

    v_org_id := v_variable.organization_id;
    v_env_id := v_variable.environment_id;

    -- Verify write access
    IF NOT has_environment_write_access(v_env_id) THEN
        RAISE EXCEPTION 'Write access denied';
    END IF;

    -- Find the audit log entry for the target version
    SELECT * INTO v_audit_entry
    FROM variable_audit_log
    WHERE variable_id = p_variable_id
    AND version_number = p_target_version
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_audit_entry IS NULL THEN
        RAISE EXCEPTION 'Version % not found in history', p_target_version;
    END IF;

    -- Determine the value to restore
    -- For the target version, the new_value in the audit log IS the value at that version
    v_rollback_value := v_audit_entry.new_value;
    v_is_secret := v_variable.is_secret;

    -- For secrets, we can't rollback using audit log text (it's vault reference)
    IF v_is_secret THEN
        RAISE EXCEPTION 'Cannot rollback secret variables. Secret values are encrypted and not stored in history.';
    END IF;

    -- Check if environment is protected
    SELECT is_protected INTO v_is_protected
    FROM environments
    WHERE id = v_env_id;

    IF v_is_protected THEN
        -- Create pending change
        INSERT INTO pending_changes (
            environment_id, organization_id, variable_id,
            action, variable_key, variable_value, is_secret,
            requested_by, comment
        ) VALUES (
            v_env_id, v_org_id, p_variable_id,
            'update', v_variable.key, v_rollback_value, false,
            auth.uid(), p_reason
        )
        RETURNING id INTO v_pending_id;

        RETURN jsonb_build_object(
            'success', true,
            'pending_change_id', v_pending_id,
            'new_version', NULL
        );
    ELSE
        -- Direct rollback
        UPDATE variables
        SET value = v_rollback_value,
            updated_by = auth.uid(),
            updated_at = now()
        WHERE id = p_variable_id
        AND version = v_variable.version;  -- optimistic lock

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Concurrent modification detected. Please retry.';
        END IF;

        -- Insert change_reason into the audit log entry that was just created by the trigger
        UPDATE variable_audit_log
        SET change_reason = p_reason
        WHERE variable_id = p_variable_id
        AND version_number = (SELECT version FROM variables WHERE id = p_variable_id)
        AND change_reason IS NULL;

        RETURN jsonb_build_object(
            'success', true,
            'pending_change_id', NULL,
            'new_version', (SELECT version FROM variables WHERE id = p_variable_id)
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION rollback_variable(UUID, INT, TEXT) TO authenticated;

-- ============================================================
-- Part B.3: create_environment_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION create_environment_snapshot(
    p_environment_id UUID,
    p_name TEXT,
    p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_snapshot_data JSONB;
    v_var_count INT;
    v_snapshot_id UUID;
BEGIN
    -- Get org_id and verify access
    SELECT organization_id INTO v_org_id
    FROM environments
    WHERE id = p_environment_id;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Environment not found';
    END IF;

    IF NOT has_environment_write_access(p_environment_id) THEN
        RAISE EXCEPTION 'Write access denied';
    END IF;

    -- Build snapshot data from current variables
    SELECT jsonb_agg(
        jsonb_build_object(
            'key', v.key,
            'value', CASE WHEN v.is_secret THEN NULL ELSE v.value END,
            'is_secret', v.is_secret,
            'vault_secret_id', v.vault_secret_id,
            'version', v.version,
            'fallback_value', v.fallback_value,
            'description', v.description
        )
    ), COUNT(*)
    INTO v_snapshot_data, v_var_count
    FROM variables v
    WHERE v.environment_id = p_environment_id;

    -- Handle empty environment
    IF v_snapshot_data IS NULL THEN
        v_snapshot_data := '[]'::JSONB;
    END IF;

    INSERT INTO environment_snapshots (
        environment_id, organization_id, name, description,
        snapshot_data, variable_count, created_by
    ) VALUES (
        p_environment_id, v_org_id, p_name, p_description,
        v_snapshot_data, v_var_count, auth.uid()
    )
    RETURNING id INTO v_snapshot_id;

    RETURN v_snapshot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_environment_snapshot(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================
-- Part B.4: compare_snapshot_to_current
-- ============================================================
CREATE OR REPLACE FUNCTION compare_snapshot_to_current(p_snapshot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_snapshot RECORD;
    v_result JSONB;
    v_added JSONB := '[]'::JSONB;
    v_removed JSONB := '[]'::JSONB;
    v_modified JSONB := '[]'::JSONB;
    v_unchanged INT := 0;
    v_snap_item JSONB;
    v_current RECORD;
    v_snap_keys TEXT[];
    v_current_keys TEXT[];
BEGIN
    -- Get snapshot
    SELECT * INTO v_snapshot FROM environment_snapshots WHERE id = p_snapshot_id;
    IF v_snapshot IS NULL THEN
        RAISE EXCEPTION 'Snapshot not found';
    END IF;

    -- Verify access
    IF NOT EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = v_snapshot.organization_id
        AND user_id = auth.uid()
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Get snapshot keys
    SELECT array_agg(item->>'key')
    INTO v_snap_keys
    FROM jsonb_array_elements(v_snapshot.snapshot_data) item;

    v_snap_keys := COALESCE(v_snap_keys, ARRAY[]::TEXT[]);

    -- Get current variable keys
    SELECT array_agg(key)
    INTO v_current_keys
    FROM variables
    WHERE environment_id = v_snapshot.environment_id;

    v_current_keys := COALESCE(v_current_keys, ARRAY[]::TEXT[]);

    -- Find added (in snapshot, not in current)
    FOR v_snap_item IN SELECT * FROM jsonb_array_elements(v_snapshot.snapshot_data)
    LOOP
        IF NOT (v_snap_item->>'key' = ANY(v_current_keys)) THEN
            v_added := v_added || jsonb_build_array(jsonb_build_object(
                'key', v_snap_item->>'key',
                'snapshot_value', CASE WHEN (v_snap_item->>'is_secret')::BOOLEAN THEN '[encrypted]' ELSE v_snap_item->>'value' END
            ));
        END IF;
    END LOOP;

    -- Find removed (in current, not in snapshot) and modified/unchanged
    FOR v_current IN SELECT * FROM variables WHERE environment_id = v_snapshot.environment_id
    LOOP
        IF NOT (v_current.key = ANY(v_snap_keys)) THEN
            v_removed := v_removed || jsonb_build_array(jsonb_build_object(
                'key', v_current.key,
                'current_value', CASE WHEN v_current.is_secret THEN '[encrypted]' ELSE v_current.value END
            ));
        ELSE
            -- Key exists in both -- compare values
            SELECT item INTO v_snap_item
            FROM jsonb_array_elements(v_snapshot.snapshot_data) item
            WHERE item->>'key' = v_current.key
            LIMIT 1;

            IF v_current.is_secret OR (v_snap_item->>'is_secret')::BOOLEAN THEN
                -- For secrets, compare vault_secret_id
                IF v_current.vault_secret_id::TEXT != COALESCE(v_snap_item->>'vault_secret_id', '') THEN
                    v_modified := v_modified || jsonb_build_array(jsonb_build_object(
                        'key', v_current.key,
                        'snapshot_value', '[encrypted]',
                        'current_value', '[encrypted]',
                        'is_secret', true
                    ));
                ELSE
                    v_unchanged := v_unchanged + 1;
                END IF;
            ELSE
                IF v_current.value != COALESCE(v_snap_item->>'value', '') THEN
                    v_modified := v_modified || jsonb_build_array(jsonb_build_object(
                        'key', v_current.key,
                        'snapshot_value', v_snap_item->>'value',
                        'current_value', v_current.value
                    ));
                ELSE
                    v_unchanged := v_unchanged + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'added', v_added,
        'removed', v_removed,
        'modified', v_modified,
        'unchanged', v_unchanged
    );
END;
$$;

GRANT EXECUTE ON FUNCTION compare_snapshot_to_current(UUID) TO authenticated;

-- ============================================================
-- Part B.5: restore_environment_snapshot
-- ============================================================
CREATE OR REPLACE FUNCTION restore_environment_snapshot(
    p_snapshot_id UUID,
    p_reason TEXT DEFAULT 'Restored from snapshot'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_snapshot RECORD;
    v_is_protected BOOLEAN;
    v_env_id UUID;
    v_org_id UUID;
    v_snap_item JSONB;
    v_current RECORD;
    v_snap_keys TEXT[];
    v_current_keys TEXT[];
    v_added INT := 0;
    v_removed INT := 0;
    v_modified INT := 0;
    v_pending INT := 0;
    v_var_id UUID;
BEGIN
    -- Get snapshot
    SELECT * INTO v_snapshot FROM environment_snapshots WHERE id = p_snapshot_id;
    IF v_snapshot IS NULL THEN
        RAISE EXCEPTION 'Snapshot not found';
    END IF;

    v_env_id := v_snapshot.environment_id;
    v_org_id := v_snapshot.organization_id;

    -- Verify write access
    IF NOT has_environment_write_access(v_env_id) THEN
        RAISE EXCEPTION 'Write access denied';
    END IF;

    -- Check if protected
    SELECT is_protected INTO v_is_protected
    FROM environments WHERE id = v_env_id;

    -- Get snapshot keys
    SELECT array_agg(item->>'key')
    INTO v_snap_keys
    FROM jsonb_array_elements(v_snapshot.snapshot_data) item;
    v_snap_keys := COALESCE(v_snap_keys, ARRAY[]::TEXT[]);

    -- Get current keys
    SELECT array_agg(key)
    INTO v_current_keys
    FROM variables WHERE environment_id = v_env_id;
    v_current_keys := COALESCE(v_current_keys, ARRAY[]::TEXT[]);

    -- Process snapshot items (add new / update modified)
    FOR v_snap_item IN SELECT * FROM jsonb_array_elements(v_snapshot.snapshot_data)
    LOOP
        -- Skip secrets for restore (can't recreate vault entries from snapshot)
        IF (v_snap_item->>'is_secret')::BOOLEAN THEN
            CONTINUE;
        END IF;

        IF NOT (v_snap_item->>'key' = ANY(v_current_keys)) THEN
            -- Variable in snapshot but not current -- add it
            IF v_is_protected THEN
                INSERT INTO pending_changes (
                    environment_id, organization_id, action,
                    variable_key, variable_value, is_secret,
                    requested_by, comment
                ) VALUES (
                    v_env_id, v_org_id, 'create',
                    v_snap_item->>'key', v_snap_item->>'value', false,
                    auth.uid(), p_reason
                );
                v_pending := v_pending + 1;
            ELSE
                INSERT INTO variables (
                    organization_id, environment_id, key, value,
                    is_secret, fallback_value, description, updated_by
                ) VALUES (
                    v_org_id, v_env_id, v_snap_item->>'key', v_snap_item->>'value',
                    false, v_snap_item->>'fallback_value', v_snap_item->>'description',
                    auth.uid()
                );
                v_added := v_added + 1;
            END IF;
        ELSE
            -- Key exists in both -- check if modified
            SELECT * INTO v_current
            FROM variables
            WHERE environment_id = v_env_id AND key = v_snap_item->>'key';

            IF v_current.value != COALESCE(v_snap_item->>'value', '') THEN
                IF v_is_protected THEN
                    INSERT INTO pending_changes (
                        environment_id, organization_id, variable_id, action,
                        variable_key, variable_value, is_secret,
                        old_key, old_value,
                        requested_by, comment
                    ) VALUES (
                        v_env_id, v_org_id, v_current.id, 'update',
                        v_current.key, v_snap_item->>'value', false,
                        v_current.key, v_current.value,
                        auth.uid(), p_reason
                    );
                    v_pending := v_pending + 1;
                ELSE
                    UPDATE variables
                    SET value = v_snap_item->>'value',
                        fallback_value = COALESCE(v_snap_item->>'fallback_value', fallback_value),
                        description = COALESCE(v_snap_item->>'description', description),
                        updated_by = auth.uid(),
                        updated_at = now()
                    WHERE id = v_current.id;
                    v_modified := v_modified + 1;
                END IF;
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'added', v_added,
        'removed', v_removed,
        'modified', v_modified,
        'pending', v_pending
    );
END;
$$;

GRANT EXECUTE ON FUNCTION restore_environment_snapshot(UUID, TEXT) TO authenticated;
