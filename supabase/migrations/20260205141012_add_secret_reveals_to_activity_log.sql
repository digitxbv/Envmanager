-- =====================================================
-- Add Secret Reveals to Activity Log
-- =====================================================
-- Extends get_activity_log to include secret_view_log entries
-- as action='viewed' type='secret_view'

CREATE OR REPLACE FUNCTION get_activity_log(
    p_organization_id UUID,
    p_limit INTEGER DEFAULT 25,
    p_offset INTEGER DEFAULT 0,
    p_project_id UUID DEFAULT NULL,
    p_environment_id UUID DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    type TEXT,
    action TEXT,
    user_email TEXT,
    project_id UUID,
    project_name TEXT,
    environment_id UUID,
    environment_name TEXT,
    variable_key TEXT,
    file_name TEXT,
    old_value TEXT,
    new_value TEXT,
    variables_imported INTEGER,
    variables_skipped INTEGER,
    variables_overwritten INTEGER,
    created_at TIMESTAMPTZ,
    total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role TEXT;
    v_total BIGINT;
BEGIN
    -- Verify user has access and is owner or admin
    SELECT om.role INTO v_user_role
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
    AND om.user_id = auth.uid();

    IF v_user_role IS NULL THEN
        RAISE EXCEPTION 'Access denied to organization';
    END IF;

    IF v_user_role NOT IN ('owner', 'admin') THEN
        RAISE EXCEPTION 'Only owners and admins can view activity logs';
    END IF;

    -- Get total count first
    SELECT COUNT(*) INTO v_total
    FROM (
        -- Variable audit entries
        SELECT val.id
        FROM variable_audit_log val
        JOIN environments e ON e.id = val.environment_id
        JOIN projects p ON p.id = e.project_id
        WHERE val.organization_id = p_organization_id
        AND (p_project_id IS NULL OR p.id = p_project_id)
        AND (p_environment_id IS NULL OR val.environment_id = p_environment_id)
        AND (p_action IS NULL OR val.action = p_action)
        AND (p_date_from IS NULL OR val.created_at >= p_date_from)
        AND (p_date_to IS NULL OR val.created_at <= p_date_to)

        UNION ALL

        -- Import history entries (action = 'imported')
        SELECT ih.id
        FROM import_history ih
        JOIN environments e ON e.id = ih.environment_id
        JOIN projects p ON p.id = e.project_id
        WHERE ih.organization_id = p_organization_id
        AND (p_project_id IS NULL OR p.id = p_project_id)
        AND (p_environment_id IS NULL OR ih.environment_id = p_environment_id)
        AND (p_action IS NULL OR p_action = 'imported')
        AND (p_date_from IS NULL OR ih.created_at >= p_date_from)
        AND (p_date_to IS NULL OR ih.created_at <= p_date_to)

        UNION ALL

        -- Secret view log entries (action = 'viewed')
        SELECT svl.id
        FROM secret_view_log svl
        JOIN temporary_access_grants tag ON tag.id = svl.grant_id
        JOIN environments e ON e.id = tag.environment_id
        JOIN projects p ON p.id = e.project_id
        WHERE tag.organization_id = p_organization_id
        AND (p_project_id IS NULL OR p.id = p_project_id)
        AND (p_environment_id IS NULL OR tag.environment_id = p_environment_id)
        AND (p_action IS NULL OR p_action = 'viewed')
        AND (p_date_from IS NULL OR svl.viewed_at >= p_date_from)
        AND (p_date_to IS NULL OR svl.viewed_at <= p_date_to)
    ) AS combined;

    -- Return combined results
    RETURN QUERY
    SELECT * FROM (
        -- Variable audit entries
        SELECT
            val.id,
            'variable'::TEXT as type,
            val.action,
            COALESCE(au.email, 'Unknown')::TEXT as user_email,
            p.id as project_id,
            p.name as project_name,
            e.id as environment_id,
            e.name as environment_name,
            v.key as variable_key,
            NULL::TEXT as file_name,
            val.old_value,
            val.new_value,
            NULL::INTEGER as variables_imported,
            NULL::INTEGER as variables_skipped,
            NULL::INTEGER as variables_overwritten,
            val.created_at,
            v_total as total_count
        FROM variable_audit_log val
        JOIN environments e ON e.id = val.environment_id
        JOIN projects p ON p.id = e.project_id
        LEFT JOIN variables v ON v.id = val.variable_id
        LEFT JOIN auth.users au ON au.id = val.user_id
        WHERE val.organization_id = p_organization_id
        AND (p_project_id IS NULL OR p.id = p_project_id)
        AND (p_environment_id IS NULL OR val.environment_id = p_environment_id)
        AND (p_action IS NULL OR val.action = p_action)
        AND (p_date_from IS NULL OR val.created_at >= p_date_from)
        AND (p_date_to IS NULL OR val.created_at <= p_date_to)

        UNION ALL

        -- Import history entries
        SELECT
            ih.id,
            'import'::TEXT as type,
            'imported'::TEXT as action,
            COALESCE(au.email, 'Unknown')::TEXT as user_email,
            p.id as project_id,
            p.name as project_name,
            e.id as environment_id,
            e.name as environment_name,
            NULL::TEXT as variable_key,
            ih.file_name,
            NULL::TEXT as old_value,
            NULL::TEXT as new_value,
            ih.variables_imported,
            ih.variables_skipped,
            ih.variables_overwritten,
            ih.created_at,
            v_total as total_count
        FROM import_history ih
        JOIN environments e ON e.id = ih.environment_id
        JOIN projects p ON p.id = e.project_id
        LEFT JOIN auth.users au ON au.id = ih.user_id
        WHERE ih.organization_id = p_organization_id
        AND (p_project_id IS NULL OR p.id = p_project_id)
        AND (p_environment_id IS NULL OR ih.environment_id = p_environment_id)
        AND (p_action IS NULL OR p_action = 'imported')
        AND (p_date_from IS NULL OR ih.created_at >= p_date_from)
        AND (p_date_to IS NULL OR ih.created_at <= p_date_to)

        UNION ALL

        -- Secret view log entries
        SELECT
            svl.id,
            'secret_view'::TEXT as type,
            'viewed'::TEXT as action,
            COALESCE(au.email, 'Unknown')::TEXT as user_email,
            p.id as project_id,
            p.name as project_name,
            e.id as environment_id,
            e.name as environment_name,
            v.key as variable_key,
            NULL::TEXT as file_name,
            NULL::TEXT as old_value,
            NULL::TEXT as new_value,
            NULL::INTEGER as variables_imported,
            NULL::INTEGER as variables_skipped,
            NULL::INTEGER as variables_overwritten,
            svl.viewed_at as created_at,
            v_total as total_count
        FROM secret_view_log svl
        JOIN temporary_access_grants tag ON tag.id = svl.grant_id
        JOIN environments e ON e.id = tag.environment_id
        JOIN projects p ON p.id = e.project_id
        LEFT JOIN variables v ON v.id = svl.variable_id
        LEFT JOIN auth.users au ON au.id = svl.viewed_by
        WHERE tag.organization_id = p_organization_id
        AND (p_project_id IS NULL OR p.id = p_project_id)
        AND (p_environment_id IS NULL OR tag.environment_id = p_environment_id)
        AND (p_action IS NULL OR p_action = 'viewed')
        AND (p_date_from IS NULL OR svl.viewed_at >= p_date_from)
        AND (p_date_to IS NULL OR svl.viewed_at <= p_date_to)
    ) AS combined
    ORDER BY created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_activity_log IS
    'Get unified activity log combining variable changes, imports, and secret reveals. Only accessible by organization owners and admins.';
