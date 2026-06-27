-- =====================================================
-- BULK UPDATE VARIABLES RPC FUNCTION
-- =====================================================
-- PRD: 01 (Bulk Variable Updates) — Task 3.1
-- Description: Atomic bulk variable updates across multiple environments.
--   Non-protected environment updates succeed or fail together.
--   Protected environment changes create pending_changes rows.
-- =====================================================

CREATE OR REPLACE FUNCTION bulk_update_variables(
    p_updates JSONB,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_batch_id UUID := gen_random_uuid();
    v_user_id UUID;
    v_update JSONB;
    v_variable RECORD;
    v_env RECORD;
    v_applied INT := 0;
    v_pending INT := 0;
    v_results JSONB := '[]'::JSONB;
    v_pending_id UUID;
    v_org_id UUID;
BEGIN
    -- Check authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Handle empty updates
    IF p_updates IS NULL OR jsonb_array_length(p_updates) = 0 THEN
        RETURN jsonb_build_object(
            'success', true,
            'batch_id', v_batch_id,
            'applied', 0,
            'pending', 0,
            'results', '[]'::JSONB
        );
    END IF;

    -- Set change_reason for the audit trigger to pick up
    IF p_reason IS NOT NULL AND p_reason != '' THEN
        PERFORM set_config('app.change_reason', p_reason, true);
    END IF;

    -- ============================================================
    -- Phase 1: Validate all environment access upfront
    -- ============================================================
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        -- Check user has access to the environment
        IF NOT EXISTS (
            SELECT 1 FROM environment_access ea
            WHERE ea.environment_id = (v_update->>'environment_id')::UUID
            AND ea.user_id = v_user_id
        ) THEN
            RAISE EXCEPTION 'Access denied to environment %', v_update->>'environment_id';
        END IF;

        -- Check variable exists and belongs to the specified environment
        IF NOT EXISTS (
            SELECT 1 FROM variables
            WHERE id = (v_update->>'variable_id')::UUID
            AND environment_id = (v_update->>'environment_id')::UUID
        ) THEN
            RAISE EXCEPTION 'Variable % not found in environment %',
                v_update->>'variable_id', v_update->>'environment_id';
        END IF;
    END LOOP;

    -- ============================================================
    -- Phase 2: Apply non-protected environment updates (atomic)
    -- ============================================================
    BEGIN
        FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
        LOOP
            -- Get environment protection status
            SELECT e.id, e.is_protected, e.organization_id
            INTO v_env
            FROM environments e
            WHERE e.id = (v_update->>'environment_id')::UUID;

            -- Skip protected environments in this phase
            IF v_env.is_protected THEN
                CONTINUE;
            END IF;

            -- Perform the update
            UPDATE variables
            SET value = v_update->>'new_value',
                is_secret = COALESCE((v_update->>'is_secret')::BOOLEAN, is_secret),
                updated_by = v_user_id,
                updated_at = now()
            WHERE id = (v_update->>'variable_id')::UUID
            AND environment_id = (v_update->>'environment_id')::UUID;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Failed to update variable %', v_update->>'variable_id';
            END IF;

            v_applied := v_applied + 1;
            v_results := v_results || jsonb_build_array(jsonb_build_object(
                'variable_id', v_update->>'variable_id',
                'status', 'applied',
                'new_version', (SELECT version FROM variables WHERE id = (v_update->>'variable_id')::UUID)
            ));
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            -- All non-protected updates fail together — re-raise
            RAISE;
    END;

    -- ============================================================
    -- Phase 3: Create pending changes for protected environments
    -- ============================================================
    FOR v_update IN SELECT * FROM jsonb_array_elements(p_updates)
    LOOP
        -- Get environment protection status
        SELECT e.id, e.is_protected, e.organization_id
        INTO v_env
        FROM environments e
        WHERE e.id = (v_update->>'environment_id')::UUID;

        -- Skip non-protected environments (already handled)
        IF NOT v_env.is_protected THEN
            CONTINUE;
        END IF;

        -- Get current variable info for old_key/old_value
        SELECT * INTO v_variable
        FROM variables
        WHERE id = (v_update->>'variable_id')::UUID;

        -- Create pending change
        INSERT INTO pending_changes (
            environment_id, organization_id, variable_id, action,
            variable_key, variable_value, is_secret,
            old_key, old_value,
            requested_by, comment
        ) VALUES (
            v_env.id, v_env.organization_id, v_variable.id, 'update',
            v_variable.key, v_update->>'new_value',
            COALESCE((v_update->>'is_secret')::BOOLEAN, v_variable.is_secret),
            v_variable.key, v_variable.value,
            v_user_id, p_reason
        )
        RETURNING id INTO v_pending_id;

        v_pending := v_pending + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
            'variable_id', v_update->>'variable_id',
            'status', 'pending',
            'pending_change_id', v_pending_id
        ));
    END LOOP;

    -- ============================================================
    -- Phase 4: Update audit log entries with batch_id and change_reason
    -- ============================================================
    UPDATE variable_audit_log
    SET batch_id = v_batch_id,
        change_reason = COALESCE(p_reason, change_reason)
    WHERE batch_id IS NULL
    AND user_id = v_user_id
    AND created_at >= now() - interval '5 seconds'
    AND variable_id IN (
        SELECT (item->>'variable_id')::UUID
        FROM jsonb_array_elements(p_updates) item
    );

    RETURN jsonb_build_object(
        'success', true,
        'batch_id', v_batch_id,
        'applied', v_applied,
        'pending', v_pending,
        'results', v_results
    );
END;
$$;

GRANT EXECUTE ON FUNCTION bulk_update_variables(JSONB, TEXT) TO authenticated;

COMMENT ON FUNCTION bulk_update_variables IS
    'Atomic bulk update of variables across multiple environments. Non-protected env updates are atomic (all or nothing). Protected env changes create pending_changes rows for approval.';
