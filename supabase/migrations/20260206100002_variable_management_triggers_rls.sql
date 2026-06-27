-- Migration: Variable Management — Triggers, Indexes, RLS
-- PRDs: 04 (Version History), 02 (Access Tracking), 03 (Naming Conventions)

-- ============================================================
-- 1. Update log_variable_change() trigger to populate new columns
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
BEGIN
    IF TG_OP = 'INSERT' THEN
        action_type := 'created';
        old_val := NULL;
        IF NEW.is_secret THEN
            new_val := 'vault:' || NEW.vault_secret_id::TEXT;
        ELSE
            new_val := NEW.value;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        action_type := 'updated';
        IF OLD.is_secret OR NEW.is_secret THEN
            old_val := 'vault:' || COALESCE(OLD.vault_secret_id::TEXT, 'none');
            new_val := 'vault:' || COALESCE(NEW.vault_secret_id::TEXT, 'none');
        ELSE
            old_val := OLD.value;
            new_val := NEW.value;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        action_type := 'deleted';
        IF OLD.is_secret THEN
            old_val := 'vault:' || OLD.vault_secret_id::TEXT;
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
        version_number
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
        COALESCE(NEW.version, OLD.version)
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- ============================================================
-- 2. Indexes for performance
-- ============================================================

-- Fast history lookups by variable + version
CREATE INDEX IF NOT EXISTS idx_audit_log_variable_version
ON variable_audit_log(variable_id, version_number DESC);

-- Fast history lookups by key (for deleted variables)
CREATE INDEX IF NOT EXISTS idx_audit_log_variable_key
ON variable_audit_log(variable_key);

-- Batch lookups for bulk operations
CREATE INDEX IF NOT EXISTS idx_audit_log_batch_id
ON variable_audit_log(batch_id) WHERE batch_id IS NOT NULL;

-- Naming conventions by org
CREATE INDEX IF NOT EXISTS idx_naming_conventions_org
ON naming_conventions(organization_id);

-- Naming conventions by project
CREATE INDEX IF NOT EXISTS idx_naming_conventions_project
ON naming_conventions(project_id) WHERE project_id IS NOT NULL;

-- Snapshots by environment (most recent first)
CREATE INDEX IF NOT EXISTS idx_snapshots_env
ON environment_snapshots(environment_id, created_at DESC);

-- Access log by variable (most recent first)
CREATE INDEX IF NOT EXISTS idx_access_log_variable
ON variable_access_log(variable_id, accessed_at DESC);

-- Access log by environment (most recent first)
CREATE INDEX IF NOT EXISTS idx_access_log_env
ON variable_access_log(environment_id, accessed_at DESC);

-- ============================================================
-- 3. Enable RLS on new tables
-- ============================================================
ALTER TABLE naming_conventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE environment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_access_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS Policies: naming_conventions
-- ============================================================

-- SELECT: org members can read
CREATE POLICY naming_conventions_select ON naming_conventions
    FOR SELECT USING (
        organization_id IN (SELECT get_user_organization_ids())
    );

-- INSERT: org admin/owner only
CREATE POLICY naming_conventions_insert ON naming_conventions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = naming_conventions.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- UPDATE: org admin/owner only
CREATE POLICY naming_conventions_update ON naming_conventions
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = naming_conventions.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- DELETE: org admin/owner only
CREATE POLICY naming_conventions_delete ON naming_conventions
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = naming_conventions.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- ============================================================
-- 5. RLS Policies: environment_snapshots
-- ============================================================

-- SELECT: org members can read
CREATE POLICY environment_snapshots_select ON environment_snapshots
    FOR SELECT USING (
        organization_id IN (SELECT get_user_organization_ids())
    );

-- INSERT: users with environment access can create
CREATE POLICY environment_snapshots_insert ON environment_snapshots
    FOR INSERT WITH CHECK (
        organization_id IN (SELECT get_user_organization_ids())
        AND has_environment_write_access(environment_id)
    );

-- DELETE: org admin/owner only
CREATE POLICY environment_snapshots_delete ON environment_snapshots
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = environment_snapshots.organization_id
            AND om.user_id = auth.uid()
            AND om.role IN ('owner', 'admin')
        )
    );

-- ============================================================
-- 6. RLS Policies: variable_access_log (append-only)
-- ============================================================

-- SELECT: org members can read
CREATE POLICY variable_access_log_select ON variable_access_log
    FOR SELECT USING (
        organization_id IN (SELECT get_user_organization_ids())
    );

-- No INSERT policy — handled by SECURITY DEFINER RPC functions
-- No UPDATE policy — append-only
-- No DELETE policy — append-only
