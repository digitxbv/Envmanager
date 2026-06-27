-- Migration: Update RLS policies for granular access control
-- Requires: 20260202164111_add_granular_access_control.sql (schema changes)

BEGIN;

-- =====================================================
-- Variables: Require write access for INSERT/UPDATE/DELETE
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert variables in accessible environments" ON variables;
DROP POLICY IF EXISTS "Users can update variables in accessible environments" ON variables;
DROP POLICY IF EXISTS "Users can delete variables in accessible environments" ON variables;

-- Variables: INSERT policy - require write access
CREATE POLICY "Users can insert variables with write access"
ON variables FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (SELECT get_user_organization_ids())
  AND has_environment_write_access(environment_id)
);

-- Variables: UPDATE policy - require write access
CREATE POLICY "Users can update variables with write access"
ON variables FOR UPDATE
TO authenticated
USING (
  organization_id IN (SELECT get_user_organization_ids())
  AND has_environment_write_access(environment_id)
)
WITH CHECK (
  organization_id IN (SELECT get_user_organization_ids())
  AND has_environment_write_access(environment_id)
);

-- Variables: DELETE policy - require write access
CREATE POLICY "Users can delete variables with write access"
ON variables FOR DELETE
TO authenticated
USING (
  organization_id IN (SELECT get_user_organization_ids())
  AND has_environment_write_access(environment_id)
);

-- =====================================================
-- Projects: Viewers cannot create
-- =====================================================

DROP POLICY IF EXISTS "Organization members can insert projects" ON projects;

CREATE POLICY "Non-viewers can create projects"
ON projects FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
    AND role != 'viewer'
  )
);

-- =====================================================
-- Environments: Viewers cannot create
-- =====================================================

DROP POLICY IF EXISTS "Organization members can insert environments" ON environments;

CREATE POLICY "Non-viewers can create environments"
ON environments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members om ON om.organization_id = p.organization_id
    WHERE p.id = project_id
    AND om.user_id = auth.uid()
    AND om.role != 'viewer'
  )
);

-- =====================================================
-- Grant execute on new helper functions
-- =====================================================

GRANT EXECUTE ON FUNCTION has_environment_write_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION has_environment_read_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_see_environment_values(UUID) TO authenticated;

COMMIT;
